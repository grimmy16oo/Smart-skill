import mongoose from "mongoose";

const googleCredentialSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    googleEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    encryptedAccessToken: {
      type: String,
      default: "",
      select: false,
    },
    encryptedRefreshToken: {
      type: String,
      default: "",
      select: false,
    },
    tokenType: {
      type: String,
      default: "Bearer",
    },
    scope: {
      type: String,
      default: "",
    },
    expiryDate: {
      type: Date,
      default: null,
    },
    connectedAt: {
      type: Date,
      default: Date.now,
    },
    lastError: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

export default mongoose.model("GoogleCredential", googleCredentialSchema);
