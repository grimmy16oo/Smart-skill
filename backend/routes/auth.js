import express from "express";
import User from "../models/User.js";
import { generateToken, protect } from "../middleware/auth.js";
import { serializeUser } from "../utils/serializers.js";

const router = express.Router();

function cleanSkillList(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((skill) => String(skill).trim())
    .filter(Boolean);
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

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      bio: bio?.trim() || "",
      location: location?.trim() || "",
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
      } else {
        updates[field] = String(req.body[field]).trim();
      }
    });

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
