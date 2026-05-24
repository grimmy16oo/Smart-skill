import mongoose from "mongoose";

const swipeActionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      enum: ["like", "skip"],
      required: true,
    },
    scoreSnapshot: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

swipeActionSchema.index({ user: 1, targetUser: 1 }, { unique: true });
swipeActionSchema.index({ user: 1, action: 1, updatedAt: -1 });

export default mongoose.model("SwipeAction", swipeActionSchema);
