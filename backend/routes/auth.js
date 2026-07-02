import express from "express";
import crypto from "crypto";
import User from "../models/User.js";
import { generateToken, protect } from "../middleware/auth.js";
import { verifyGoogleIdToken } from "../config/firebaseAdmin.js";
import { serializeUser } from "../utils/serializers.js";

const router = express.Router();

function cleanSkillList(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((skill) => String(skill).trim())
    .filter(Boolean)
    .slice(0, 20);
}

function cleanText(value, maxLength) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function getAuthPayload(user) {
  return {
    success: true,
    token: generateToken(user._id),
    user: serializeUser(user),
  };
}

router.post("/register", async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      bio,
      location,
      skillsOffered,
      skillsWanted,
      avatar,
    } = req.body;

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }

    const user = await User.create({
      name: cleanText(name, 80),
      email: normalizedEmail,
      password,
      bio: cleanText(bio, 500),
      location: cleanText(location, 80),
      skillsOffered: cleanSkillList(skillsOffered),
      skillsWanted: cleanSkillList(skillsWanted),
      avatar: avatar || "",
    });

    res.status(201).json(getAuthPayload(user));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email?.trim() || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+password");

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.status(200).json(getAuthPayload(user));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/google", async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ message: "Google credential is required" });
    }

    const decoded = await verifyGoogleIdToken(idToken);
    const email = decoded.email?.trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ message: "Google account must include an email" });
    }

    let user = await User.findOne({
      $or: [{ email }, { googleUid: decoded.uid }],
    });

    if (!user) {
      user = await User.create({
        name: cleanText(decoded.name || email.split("@")[0], 80),
        email,
        password: crypto.randomBytes(32).toString("hex"),
        authProvider: "google",
        googleUid: decoded.uid,
        avatar: decoded.picture || "",
        bio: "",
        location: "",
        skillsOffered: [],
        skillsWanted: [],
      });
    } else {
      user.googleUid = user.googleUid || decoded.uid;
      user.authProvider = user.authProvider === "local" ? "local" : "google";
      if (!user.avatar && decoded.picture) user.avatar = decoded.picture;
      if (!user.name && decoded.name) user.name = cleanText(decoded.name, 80);
      await user.save();
    }

    res.status(200).json(getAuthPayload(user));
  } catch (error) {
    console.error("Google auth failed:", error.message);
    res.status(401).json({ message: "Google sign-in failed" });
  }
});

router.get("/me", protect, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ success: true, user: serializeUser(user) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put("/profile", protect, async (req, res) => {
  try {
    const allowedUpdates = ["name", "avatar", "bio", "location", "skillsOffered", "skillsWanted"];
    const updates = {};

    allowedUpdates.forEach((field) => {
      if (req.body[field] === undefined) return;

      if (field === "skillsOffered" || field === "skillsWanted") {
        updates[field] = cleanSkillList(req.body[field]);
      } else if (field === "name") {
        updates[field] = cleanText(req.body[field], 80);
      } else if (field === "bio") {
        updates[field] = cleanText(req.body[field], 500);
      } else if (field === "location") {
        updates[field] = cleanText(req.body[field], 80);
      } else {
        updates[field] = String(req.body[field] ?? "").trim();
      }
    });

    if (updates.name !== undefined && !updates.name) {
      return res.status(400).json({ message: "Name is required" });
    }

    const user = await User.findByIdAndUpdate(req.userId, updates, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ success: true, user: serializeUser(user) });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

export default router;
