import express from "express";
import mongoose from "mongoose";
import Match from "../models/Match.js";
import SwapRequest from "../models/SwapRequest.js";
import User from "../models/User.js";
import { protect } from "../middleware/auth.js";
import { serializeSwapRequest } from "../utils/serializers.js";

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

async function getParticipantRequest(requestId, userId) {
  if (!isObjectId(requestId)) return null;

  return SwapRequest.findOne({
    _id: requestId,
    $or: [{ requester: userId }, { recipient: userId }],
  })
    .populate("requester", "name avatar location skillsOffered skillsWanted")
    .populate("recipient", "name avatar location skillsOffered skillsWanted")
    .populate("match", "users matchPercent");
}

router.get("/", protect, async (req, res) => {
  try {
    const status = req.query.status ? cleanText(req.query.status, 40) : null;
    const query = {
      $or: [{ requester: req.userId }, { recipient: req.userId }],
    };

    if (status) query.status = status;

    const requests = await SwapRequest.find(query)
      .populate("requester", "name avatar location skillsOffered skillsWanted")
      .populate("recipient", "name avatar location skillsOffered skillsWanted")
      .populate("match", "users matchPercent")
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      requests: requests.map((request) => serializeSwapRequest(request, req.userId)),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/", protect, async (req, res) => {
  try {
    const recipientId = req.body.recipientId;
    const matchId = req.body.matchId;

    if (!isObjectId(recipientId) || !isObjectId(matchId)) {
      return res.status(400).json({ message: "Valid recipient and match are required" });
    }

    if (recipientId === req.userId.toString()) {
      return res.status(400).json({ message: "You cannot request a swap with yourself" });
    }

    const [recipient, match] = await Promise.all([
      User.findById(recipientId),
      Match.findOne({
        _id: matchId,
        users: { $all: [req.userId, recipientId] },
      }),
    ]);

    if (!recipient || !match) {
      return res.status(404).json({ message: "Matched user not found" });
    }

    const existingPending = await SwapRequest.findOne({
      requester: req.userId,
      recipient: recipientId,
      status: "pending",
    });

    if (existingPending) {
      return res.status(409).json({ message: "You already have a pending request with this user" });
    }

    const request = await SwapRequest.create({
      requester: req.userId,
      recipient: recipientId,
      match: match._id,
      offeredSkill: cleanText(req.body.offeredSkill, 80),
      wantedSkill: cleanText(req.body.wantedSkill, 80),
      message: cleanText(req.body.message, 500),
      timeline: [{ status: "pending", note: "Swap requested", at: new Date() }],
    });

    const populated = await getParticipantRequest(request._id, req.userId);
    res.status(201).json({
      success: true,
      request: serializeSwapRequest(populated, req.userId),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.patch("/:id/status", protect, async (req, res) => {
  try {
    const nextStatus = cleanText(req.body.status, 40);
    const allowed = ["accepted", "rejected", "completed", "cancelled"];

    if (!allowed.includes(nextStatus)) {
      return res.status(400).json({ message: "Invalid request status" });
    }

    const request = await SwapRequest.findOne({
      _id: req.params.id,
      $or: [{ requester: req.userId }, { recipient: req.userId }],
    });

    if (!request) {
      return res.status(404).json({ message: "Swap request not found" });
    }

    const isRequester = request.requester.toString() === req.userId.toString();
    const isRecipient = request.recipient.toString() === req.userId.toString();

    if (["accepted", "rejected"].includes(nextStatus) && !isRecipient) {
      return res.status(403).json({ message: "Only the recipient can respond to this request" });
    }

    if (nextStatus === "cancelled" && !isRequester) {
      return res.status(403).json({ message: "Only the requester can cancel this request" });
    }

    if (nextStatus === "completed" && !["accepted"].includes(request.status)) {
      return res.status(400).json({ message: "Only accepted swaps can be completed" });
    }

    if (["accepted", "rejected", "cancelled"].includes(nextStatus) && request.status !== "pending") {
      return res.status(400).json({ message: "Only pending requests can be updated this way" });
    }

    request.status = nextStatus;
    request.timeline.push({
      status: nextStatus,
      note: cleanText(req.body.note, 240) || `Swap ${nextStatus}`,
      at: new Date(),
    });

    await request.save();

    const populated = await getParticipantRequest(request._id, req.userId);
    res.status(200).json({
      success: true,
      request: serializeSwapRequest(populated, req.userId),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
