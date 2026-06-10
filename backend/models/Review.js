import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    fromUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Review must have an author"],
    },
    toUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Review must have a target user"],
    },
    rating: {
      type: Number,
      required: [true, "Please provide a rating"],
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot exceed 5"],
    },
    text: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

// Restrict to one review from a user to another user
reviewSchema.index({ fromUser: 1, toUser: 1 }, { unique: true });

export default mongoose.model("Review", reviewSchema);
