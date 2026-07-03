import mongoose from "mongoose";

const activitySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["taught", "learned"],
      required: true,
    },
    skill: {
      type: String,
      required: true,
      trim: true,
    },
    partnerName: {
      type: String,
      default: "",
    },
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    completedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    sessionDuration: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: false }
);

export default mongoose.model("Activity", activitySchema);
