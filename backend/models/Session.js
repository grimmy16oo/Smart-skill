import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
  {
    requesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    learnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    matchId: {
      type: String,
      default: "",
      trim: true,
    },
    skill: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
    scheduledAt: {
      type: Date,
      required: true,
    },
    durationMinutes: {
      type: Number,
      default: 60,
      min: 15,
      max: 240,
    },
    meetingLink: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    proposedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "rescheduled", "cancelled", "completed"],
      default: "pending",
    },
    googleCalendar: {
      eventId: {
        type: String,
        default: "",
      },
      htmlLink: {
        type: String,
        default: "",
      },
      calendarId: {
        type: String,
        default: "primary",
      },
      organizerUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      lastSyncedAt: {
        type: Date,
        default: null,
      },
    },
  },
  { timestamps: true }
);

sessionSchema.index({ requesterId: 1, targetId: 1, createdAt: -1 });
sessionSchema.index({ teacherId: 1, learnerId: 1, scheduledAt: -1 });
sessionSchema.index({ status: 1, scheduledAt: 1 });
sessionSchema.index({ "googleCalendar.eventId": 1 });

export default mongoose.model("Session", sessionSchema);
