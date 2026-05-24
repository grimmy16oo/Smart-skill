import express from "express";
import mongoose from "mongoose";
import Like from "../models/Like.js";
import Match from "../models/Match.js";
import SwipeAction from "../models/SwipeAction.js";
import User from "../models/User.js";
import { protect } from "../middleware/auth.js";
import { computeMatchPercent, getMatchKey } from "../utils/matching.js";
import { serializeMatch } from "../utils/serializers.js";

const router = express.Router();

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

async function createMutualMatch(currentUser, targetUser) {
  const users = [currentUser._id, targetUser._id].sort((a, b) =>
    a.toString().localeCompare(b.toString())
  );
  const key = getMatchKey(users[0], users[1]);
  const matchPercent = computeMatchPercent(currentUser, targetUser);

  return Match.findOneAndUpdate(
    { key },
    {
      $setOnInsert: {
        users,
        key,
        status: "matched",
      },
      $set: { matchPercent },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

async function recordSwipeAction(user, targetUser, action) {
  const scoreSnapshot = computeMatchPercent(user, targetUser);

  await SwipeAction.findOneAndUpdate(
    { user: user._id, targetUser: targetUser._id },
    {
      $set: {
        user: user._id,
        targetUser: targetUser._id,
        action,
        scoreSnapshot,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return scoreSnapshot;
}

router.get("/", protect, async (req, res) => {
  try {
    const matches = await Match.find({ users: req.userId }).sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      matches: matches.map(serializeMatch),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/like/:targetId", protect, async (req, res) => {
  try {
    const { targetId } = req.params;

    if (!isObjectId(targetId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    if (targetId === req.userId.toString()) {
      return res.status(400).json({ message: "You cannot like yourself" });
    }

    const [currentUser, targetUser] = await Promise.all([
      User.findById(req.userId),
      User.findById(targetId),
    ]);

    if (!currentUser || !targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const scoreSnapshot = await recordSwipeAction(currentUser, targetUser, "like");

    await Like.updateOne(
      { fromUser: currentUser._id, toUser: targetUser._id },
      { $setOnInsert: { fromUser: currentUser._id, toUser: targetUser._id } },
      { upsert: true }
    );

    const reverseLike = await Like.findOne({
      fromUser: targetUser._id,
      toUser: currentUser._id,
    });

    const match = reverseLike ? await createMutualMatch(currentUser, targetUser) : null;

    res.status(200).json({
      success: true,
      liked: true,
      scoreSnapshot,
      match: serializeMatch(match),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete("/like/:targetId", protect, async (req, res) => {
  try {
    const { targetId } = req.params;

    if (!isObjectId(targetId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    await Like.deleteOne({ fromUser: req.userId, toUser: targetId });
    await SwipeAction.deleteOne({ user: req.userId, targetUser: targetId, action: "like" });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/skip/:targetId", protect, async (req, res) => {
  try {
    const { targetId } = req.params;

    if (!isObjectId(targetId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    if (targetId === req.userId.toString()) {
      return res.status(400).json({ message: "You cannot skip yourself" });
    }

    const [currentUser, targetUser] = await Promise.all([
      User.findById(req.userId),
      User.findById(targetId),
    ]);

    if (!currentUser || !targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const scoreSnapshot = await recordSwipeAction(currentUser, targetUser, "skip");

    res.status(200).json({
      success: true,
      skipped: true,
      scoreSnapshot,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete("/skip/:targetId", protect, async (req, res) => {
  try {
    const { targetId } = req.params;

    if (!isObjectId(targetId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    await SwipeAction.deleteOne({ user: req.userId, targetUser: targetId, action: "skip" });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/:targetId", protect, async (req, res) => {
  try {
    const { targetId } = req.params;

    if (!isObjectId(targetId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const [currentUser, targetUser] = await Promise.all([
      User.findById(req.userId),
      User.findById(targetId),
    ]);

    if (!currentUser || !targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const match = await createMutualMatch(currentUser, targetUser);
    res.status(201).json({ success: true, match: serializeMatch(match) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
