import express from "express";
import mongoose from "mongoose";
import Like from "../models/Like.js";
import Match from "../models/Match.js";
import SwipeAction from "../models/SwipeAction.js";
import User from "../models/User.js";
import Review from "../models/Review.js";
import { protect } from "../middleware/auth.js";
import { buildBehaviorProfile, computeMatchPercent } from "../utils/matching.js";
import { serializeUser } from "../utils/serializers.js";

const router = express.Router();

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

router.get("/featured", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 3, 12);
    const users = await User.find()
      .sort({ rating: -1, createdAt: -1 })
      .limit(limit);

    res.status(200).json({
      success: true,
      users: users.map((user) => ({
        ...serializeUser(user),
        matchPercent: 85,
        rating: user.rating || 4.8,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/swipe", protect, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);

    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const likedIds = await Like.find({ fromUser: req.userId }).distinct("toUser");
    const matches = await Match.find({ users: req.userId }).select("users");
    const matchedIds = matches
      .flatMap((match) => match.users)
      .filter((id) => id.toString() !== req.userId.toString());

    const hiddenIds = new Set([
      req.userId.toString(),
      ...likedIds.map((id) => id.toString()),
      ...matchedIds.map((id) => id.toString()),
    ]);

    const behaviorActions = await SwipeAction.find({ user: req.userId })
      .sort({ updatedAt: -1 })
      .limit(100)
      .populate("targetUser", "skillsOffered skillsWanted");
    const behaviorProfile = buildBehaviorProfile(behaviorActions);

    const users = await User.find({
      _id: { $nin: [...hiddenIds].map((id) => new mongoose.Types.ObjectId(id)) },
    }).sort({ createdAt: -1 });

    const totalInDatabase = await User.countDocuments();
    const otherUsersCount = Math.max(totalInDatabase - 1, 0);
    const scoredUsers = users
      .map((user) => ({
        ...serializeUser(user),
        matchPercent: computeMatchPercent(currentUser, user, behaviorProfile),
      }))
      .sort((a, b) => b.matchPercent - a.matchPercent || new Date(b.createdAt) - new Date(a.createdAt));

    res.status(200).json({
      success: true,
      users: scoredUsers,
      totalInDatabase,
      otherUsersCount,
      hiddenCount: Math.max(otherUsersCount - users.length, 0),
      behaviorSignals: behaviorActions.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/", protect, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.userId } }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, users: users.map(serializeUser) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/:id", protect, async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ success: true, user: serializeUser(user) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/:id/reviews", protect, async (req, res) => {
  try {
    const targetId = req.params.id;
    if (!isObjectId(targetId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const reviews = await Review.find({ toUser: targetId })
      .populate("fromUser", "name avatar")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, reviews });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/:id/reviews", protect, async (req, res) => {
  try {
    const targetId = req.params.id;
    const reviewerId = req.userId;
    const { rating, text } = req.body;

    if (!isObjectId(targetId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    if (targetId === reviewerId.toString()) {
      return res.status(400).json({ message: "You cannot review yourself" });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    // Verify they have matched before allowing a review
    const match = await Match.findOne({
      users: { $all: [reviewerId, targetId] },
    });

    if (!match) {
      return res.status(403).json({ message: "You can only review users you have matched with" });
    }

    const review = await Review.findOneAndUpdate(
      { fromUser: reviewerId, toUser: targetId },
      { fromUser: reviewerId, toUser: targetId, rating, text },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).populate("fromUser", "name avatar");

    // Recalculate average rating and reviewCount for targetUser
    const reviews = await Review.find({ toUser: targetId });
    const reviewCount = reviews.length;
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount;

    await User.findByIdAndUpdate(targetId, {
      rating: parseFloat(avgRating.toFixed(1)),
      reviewCount: reviewCount,
    });

    res.status(201).json({ success: true, review });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
