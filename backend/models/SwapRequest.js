import mongoose from "mongoose";

const timelineSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
      enum: ["pending", "accepted", "rejected", "completed", "cancelled"],
    },
    note: {
      type: String,
      default: "",
      trim: true,
      maxlength: 240,
    },
    at: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const swapRequestSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    match: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Match",
      required: true,
    },
    offeredSkill: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    wantedSkill: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    message: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "completed", "cancelled"],
      default: "pending",
    },
    timeline: {
      type: [timelineSchema],
      default: () => [{ status: "pending", note: "Swap requested", at: new Date() }],
    },
  },
  { timestamps: true }
);

swapRequestSchema.index({ requester: 1, recipient: 1, status: 1 });
swapRequestSchema.index({ recipient: 1, status: 1, updatedAt: -1 });
swapRequestSchema.index({ match: 1, updatedAt: -1 });

export default mongoose.model("SwapRequest", swapRequestSchema);
