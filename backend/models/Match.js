import mongoose from "mongoose";

const matchSchema = new mongoose.Schema(
  {
    users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    key: {
      type: String,
      required: true,
      unique: true,
    },
    matchPercent: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["matched"],
      default: "matched",
    },
  },
  { timestamps: true }
);

matchSchema.path("users").validate((users) => users.length === 2, "A match needs exactly two users");
matchSchema.index({ users: 1 });

export default mongoose.model("Match", matchSchema);
