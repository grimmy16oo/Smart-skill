import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    availability: {
  recurring: [
    {
      dayOfWeek: Number,
      startTime: String,
      endTime: String,
    },
  ],
  timezone: {
    type: String,
    default: "Asia/Dhaka",
  },
},

notifPrefs: {
  email: {
    type: Boolean,
    default: true,
  },
  browser: {
    type: Boolean,
    default: false,
  },
  inApp: {
    type: Boolean,
    default: true,
  },
},
    name: {
      type: String,
      required: [true, "Please provide a name"],
      trim: true,
      maxlength: [80, "Name must be 80 characters or fewer"],
    },
    email: {
      type: String,
      required: [true, "Please provide an email"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Invalid email"],
    },
    password: {
      type: String,
      required: [true, "Please provide a password"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false, // Don't return password by default
    },
    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
    googleUid: {
      type: String,
      default: "",
      index: true,
    },
    avatar: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      default: "",
      maxlength: [500, "Bio must be 500 characters or fewer"],
    },
    location: {
      type: String,
      default: "",
      maxlength: [80, "Location must be 80 characters or fewer"],
    },
    skillsOffered: {
      type: [String],
      default: [],
      validate: {
        validator: (skills) => skills.length <= 20,
        message: "You can list up to 20 offered skills",
      },
    },
    skillsWanted: {
      type: [String],
      default: [],
      validate: {
        validator: (skills) => skills.length <= 20,
        message: "You can list up to 20 wanted skills",
      },
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviewCount: {
      type: Number,
      default: 0,
    },
    matchCount: {
      type: Number,
      default: 0,
    },
    matches: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

userSchema.index({ createdAt: -1 });
userSchema.index({ rating: -1, createdAt: -1 });
userSchema.index({ skillsOffered: 1 });
userSchema.index({ skillsWanted: 1 });

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model("User", userSchema);
