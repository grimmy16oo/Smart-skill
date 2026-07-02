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
      required: [true, "Review text is required"],
      trim: true,
      maxlength: [800, "Review text must be 800 characters or fewer"],
    },
  },
  { timestamps: true }
);

// Restrict to one review from a user to another user
reviewSchema.index({ fromUser: 1, toUser: 1 }, { unique: true });
reviewSchema.index({ toUser: 1, createdAt: -1 });

export default mongoose.model("Review", reviewSchema);
