import express from "express";
import mongoose from "mongoose";
import Match from "../models/Match.js";
import Session from "../models/Session.js";
import User from "../models/User.js";
import { protect } from "../middleware/auth.js";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
} from "../services/googleCalendarService.js";

const router = express.Router();

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function cleanText(value, maxLength) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function serializeSession(session) {
  if (!session) return null;
  const doc = typeof session.toObject === "function" ? session.toObject() : session;

  return {
    id: doc._id.toString(),
    requesterId: doc.requesterId?.toString(),
    targetId: doc.targetId?.toString(),
    teacherId: doc.teacherId?._id?.toString?.() || doc.teacherId?.toString?.(),
    learnerId: doc.learnerId?._id?.toString?.() || doc.learnerId?.toString?.(),
    teacher: doc.teacherId?.name ? doc.teacherId : null,
    learner: doc.learnerId?.name ? doc.learnerId : null,
    matchId: doc.matchId || "",
    skill: doc.skill || "",
    scheduledAt: doc.scheduledAt,
    durationMinutes: doc.durationMinutes,
    meetingLink: doc.meetingLink || "",
    status: doc.status,
    googleCalendar: doc.googleCalendar || {},
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function populateSession(query) {
  return query
    .populate("teacherId", "name email avatar")
    .populate("learnerId", "name email avatar")
    .populate("requesterId", "name email avatar")
    .populate("targetId", "name email avatar");
}

async function getParticipantSession(sessionId, userId) {
  if (!isObjectId(sessionId)) return null;

  return populateSession(
    Session.findOne({
      _id: sessionId,
      $or: [{ teacherId: userId }, { learnerId: userId }],
    })
  );
}

async function verifyMatchIfProvided(matchId, userIds) {
  if (!matchId) return true;
  if (!isObjectId(matchId)) return false;

  const match = await Match.findOne({
    _id: matchId,
    users: { $all: userIds },
  });

  return Boolean(match);
}

async function syncConfirmedSessionToCalendar(session) {
  let event;

  try {
    event = await createCalendarEvent(session, session.teacherId._id || session.teacherId);
  } catch (error) {
    if (error.status !== 428) throw error;
    event = await createCalendarEvent(session, session.learnerId._id || session.learnerId);
  }

  session.googleCalendar = {
    eventId: event.id,
    htmlLink: event.htmlLink || "",
    calendarId: "primary",
    organizerUserId: session.teacherId._id || session.teacherId,
    lastSyncedAt: new Date(),
  };

  if (event.organizer?.email === session.learnerId.email) {
    session.googleCalendar.organizerUserId = session.learnerId._id || session.learnerId;
  }
}

router.get("/", protect, async (req, res) => {
  try {
    const sessions = await populateSession(
      Session.find({
        $or: [{ teacherId: req.userId }, { learnerId: req.userId }],
      }).sort({ scheduledAt: -1 })
    );

    res.json({
      success: true,
      sessions: sessions.map(serializeSession),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/", protect, async (req, res) => {
  try {
    const targetId = req.body.targetId;
    if (!isObjectId(targetId)) {
      return res.status(400).json({ message: "Valid target user is required" });
    }

    const scheduledAt = new Date(req.body.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      return res.status(400).json({ message: "Valid start date and time are required" });
    }

    const durationMinutes = Number(req.body.durationMinutes) || 60;
    if (durationMinutes < 15 || durationMinutes > 240) {
      return res.status(400).json({ message: "Duration must be between 15 and 240 minutes" });
    }

    const teacherId = isObjectId(req.body.teacherId) ? req.body.teacherId : targetId;
    const learnerId = isObjectId(req.body.learnerId) ? req.body.learnerId : req.userId;
    const participantIds = [teacherId, learnerId].map((id) => id.toString());

    if (!participantIds.includes(req.userId.toString())) {
      return res.status(403).json({ message: "You must be part of the session" });
    }

    const [teacher, learner, matchOk] = await Promise.all([
      User.findById(teacherId),
      User.findById(learnerId),
      verifyMatchIfProvided(req.body.matchId, participantIds),
    ]);

    if (!teacher || !learner) {
      return res.status(404).json({ message: "Session participant not found" });
    }

    if (!matchOk) {
      return res.status(403).json({ message: "A valid match is required for this session" });
    }

    const session = await Session.create({
      requesterId: req.userId,
      targetId,
      teacherId,
      learnerId,
      matchId: cleanText(req.body.matchId, 80),
      skill: cleanText(req.body.skill, 120),
      scheduledAt,
      durationMinutes,
      meetingLink: cleanText(req.body.meetingLink, 500),
      proposedBy: req.userId,
      status: "pending",
    });

    const populated = await getParticipantSession(session._id, req.userId);
    res.status(201).json({ success: true, session: serializeSession(populated) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/:id/confirm", protect, async (req, res) => {
  try {
    const session = await getParticipantSession(req.params.id, req.userId);
    if (!session) return res.status(404).json({ message: "Session not found" });

    if (session.learnerId._id.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: "Only the learner can confirm this session" });
    }

    if (!["pending", "rescheduled"].includes(session.status)) {
      return res.status(400).json({ message: "Only pending sessions can be confirmed" });
    }

    session.status = "confirmed";
    session.confirmedBy = req.userId;
    session.meetingLink = cleanText(req.body.meetingLink ?? session.meetingLink, 500);

    await syncConfirmedSessionToCalendar(session);
    await session.save();

    const populated = await getParticipantSession(session._id, req.userId);
    res.json({ success: true, session: serializeSession(populated) });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.patch("/:id/reschedule", protect, async (req, res) => {
  try {
    const session = await getParticipantSession(req.params.id, req.userId);
    if (!session) return res.status(404).json({ message: "Session not found" });

    if (session.teacherId._id.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: "Only the teacher can reschedule this session" });
    }

    const scheduledAt = new Date(req.body.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      return res.status(400).json({ message: "Valid start date and time are required" });
    }

    session.scheduledAt = scheduledAt;
    session.durationMinutes = Number(req.body.durationMinutes) || session.durationMinutes;
    session.meetingLink = cleanText(req.body.meetingLink ?? session.meetingLink, 500);

    if (session.status === "confirmed") {
      await updateCalendarEvent(session);
      session.googleCalendar.lastSyncedAt = new Date();
    } else {
      session.status = "rescheduled";
    }

    await session.save();
    const populated = await getParticipantSession(session._id, req.userId);
    res.json({ success: true, session: serializeSession(populated) });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.delete("/:id", protect, async (req, res) => {
  try {
    const session = await getParticipantSession(req.params.id, req.userId);
    if (!session) return res.status(404).json({ message: "Session not found" });

    if (session.status === "confirmed") {
      await deleteCalendarEvent(session);
    }

    session.status = "cancelled";
    session.googleCalendar.eventId = "";
    session.googleCalendar.htmlLink = "";
    session.googleCalendar.lastSyncedAt = new Date();
    await session.save();

    res.json({ success: true, session: serializeSession(session) });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

export default router;
