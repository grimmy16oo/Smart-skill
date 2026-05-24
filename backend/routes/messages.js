import express from "express";
import mongoose from "mongoose";
import Match from "../models/Match.js";
import Message from "../models/Message.js";
import { protect } from "../middleware/auth.js";
import { serializeMessage } from "../utils/serializers.js";

const router = express.Router();

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

async function findAuthorizedMatch(matchId, userId) {
  if (!isObjectId(matchId)) return null;
  return Match.findOne({ _id: matchId, users: userId });
}

router.post("/:matchId/ensure", protect, async (req, res) => {
  try {
    const match = await findAuthorizedMatch(req.params.matchId, req.userId);

    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    res.status(200).json({ success: true, matchId: match._id.toString() });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/:matchId", protect, async (req, res) => {
  try {
    const match = await findAuthorizedMatch(req.params.matchId, req.userId);

    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    const messages = await Message.find({ match: match._id }).sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      messages: messages.map(serializeMessage),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/:matchId", protect, async (req, res) => {
  try {
    const text = req.body.text?.trim();

    if (!text) {
      return res.status(400).json({ message: "Message text is required" });
    }

    const match = await findAuthorizedMatch(req.params.matchId, req.userId);

    if (!match) {
      return res.status(404).json({ message: "Match not found" });
    }

    const message = await Message.create({
      match: match._id,
      sender: req.userId,
      text,
    });

    res.status(201).json({ success: true, message: serializeMessage(message) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
