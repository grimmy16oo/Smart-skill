/**
 * mongoRoutes.js  — Express + Mongoose routes for all profile features
 *
 * Mount this file in your main server.js / app.js:
 *   import profileRoutes from "./routes/mongoRoutes.js";
 *   app.use("/api", profileRoutes);
 *
 * Assumes you already have:
 *   - express, mongoose installed
 *   - a `requireAuth` middleware that sets req.user = { _id, ... }
 *   - your User model at the path below (adjust as needed)
 */

import express from "express";
import mongoose from "mongoose";
import { protect as requireAuth } from "../middleware/auth.js";  // ← your existing auth middleware
import User from "../models/User.js";                  // ← your existing User model

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// Mongoose schemas  (add to your models folder if you prefer separate files)
// ─────────────────────────────────────────────────────────────────────────────

const projectSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  title:        { type: String, required: true, trim: true },
  description:  String,
  githubUrl:    String,
  demoUrl:      String,
  beforeImage:  String,
  afterImage:   String,
  skillsUsed:   [String],
  collaborators:[String],
  _githubMeta:  mongoose.Schema.Types.Mixed,
}, { timestamps: true });

const activitySchema = new mongoose.Schema({
  userId:          { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type:            { type: String, enum: ["taught", "learned"], required: true },
  skill:           { type: String, required: true },
  partnerName:     String,
  partnerId:       { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  completedAt:     { type: Date, default: Date.now, index: true },
  sessionDuration: Number,
}, { timestamps: false });

const sessionSchema = new mongoose.Schema({
  requesterId:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  targetId:        { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  matchId:         String,
  scheduledAt:     { type: Date, required: true },
  durationMinutes: { type: Number, default: 60 },
  skill:           String,
  status:          { type: String, enum: ["pending", "confirmed", "cancelled", "completed"], default: "pending" },
}, { timestamps: true });

const presenceSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  status:       { type: String, enum: ["online", "in_session", "away", "looking_to_learn"], default: "away" },
  statusDetail: String,
  lastSeen:     { type: Date, default: Date.now },
}, { timestamps: false });

const skillMetaSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  skills: [{
    skillName:       String,
    level:           { type: String, enum: ["Beginner", "Intermediate", "Expert"], default: "Beginner" },
    yearsExperience: { type: Number, default: 0 },
    teachingStyle:   [String],
    certificationUrl:String,
    endorsements:    { type: Number, default: 0 },
  }],
}, { timestamps: true });

// Use or create models (safe to call multiple times)
const Project   = mongoose.models.Project   || mongoose.model("Project",   projectSchema);
const Activity  = mongoose.models.Activity  || mongoose.model("Activity",  activitySchema);
const Session   = mongoose.models.Session   || mongoose.model("Session",   sessionSchema);
const Presence  = mongoose.models.Presence  || mongoose.model("Presence",  presenceSchema);
const SkillMeta = mongoose.models.SkillMeta || mongoose.model("SkillMeta", skillMetaSchema);

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────
function toObjId(id) {
  try { return new mongoose.Types.ObjectId(id); }
  catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// AVAILABILITY  (stored on the User document)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/users/:uid/availability
router.get("/users/:uid/availability", async (req, res) => {
  try {
    const user = await User.findById(req.params.uid).select("availability").lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user.availability ?? { recurring: [], timezone: "UTC" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// PUT /api/users/:uid/availability  (own profile only)
router.put("/users/:uid/availability", requireAuth, async (req, res) => {
  if (req.user._id.toString() !== req.params.uid)
    return res.status(403).json({ message: "Forbidden" });
  try {
    const { recurring, timezone } = req.body;
    await User.findByIdAndUpdate(req.params.uid, { $set: { availability: { recurring, timezone } } });
    res.json({ recurring, timezone });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PROJECTS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/users/:uid/projects
router.get("/users/:uid/projects", async (req, res) => {
  try {
    const uid = toObjId(req.params.uid);
    if (!uid) return res.status(400).json({ message: "Invalid uid" });
    const projects = await Project.find({ userId: uid }).sort({ createdAt: -1 }).lean();
    res.json(projects);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// POST /api/users/:uid/projects  (own only)
router.post("/users/:uid/projects", requireAuth, async (req, res) => {
  if (req.user._id.toString() !== req.params.uid)
    return res.status(403).json({ message: "Forbidden" });
  try {
    const project = await Project.create({ userId: req.params.uid, ...req.body });
    res.status(201).json(project);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// PUT /api/projects/:id  (own only)
router.put("/projects/:id", requireAuth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Not found" });
    if (project.userId.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Forbidden" });
    Object.assign(project, req.body);
    await project.save();
    res.json(project);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// DELETE /api/projects/:id  (own only)
router.delete("/projects/:id", requireAuth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Not found" });
    if (project.userId.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Forbidden" });
    await project.deleteOne();
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SESSIONS
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/sessions
router.post("/sessions", requireAuth, async (req, res) => {
  try {
    const session = await Session.create({ ...req.body, requesterId: req.user._id });
    res.status(201).json(session);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVITIES
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/users/:uid/activities?limit=50
router.get("/users/:uid/activities", async (req, res) => {
  try {
    const uid   = toObjId(req.params.uid);
    if (!uid) return res.status(400).json({ message: "Invalid uid" });
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const acts  = await Activity.find({ userId: uid }).sort({ completedAt: -1 }).limit(limit).lean();
    res.json(acts);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// POST /api/activities
router.post("/activities", requireAuth, async (req, res) => {
  try {
    const act = await Activity.create({ ...req.body, userId: req.user._id });
    res.status(201).json(act);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PRESENCE
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/presence/:uid
router.get("/presence/:uid", async (req, res) => {
  try {
    const uid = toObjId(req.params.uid);
    if (!uid) return res.status(400).json({ message: "Invalid uid" });
    const p = await Presence.findOne({ userId: uid }).lean();
    res.json(p ?? { status: "away", lastSeen: null });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// PUT /api/presence/:uid  (own only)
router.put("/presence/:uid", requireAuth, async (req, res) => {
  if (req.user._id.toString() !== req.params.uid)
    return res.status(403).json({ message: "Forbidden" });
  try {
    const { status, statusDetail } = req.body;
    const p = await Presence.findOneAndUpdate(
      { userId: req.params.uid },
      { status, statusDetail, lastSeen: new Date() },
      { upsert: true, new: true }
    );
    res.json(p);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SKILL META & ENDORSEMENTS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/users/:uid/skill-meta
router.get("/users/:uid/skill-meta", async (req, res) => {
  try {
    const uid = toObjId(req.params.uid);
    if (!uid) return res.status(400).json({ message: "Invalid uid" });
    const meta = await SkillMeta.findOne({ userId: uid }).lean();
    res.json(meta ?? { skills: [] });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// PUT /api/users/:uid/skill-meta  (own only)
router.put("/users/:uid/skill-meta", requireAuth, async (req, res) => {
  if (req.user._id.toString() !== req.params.uid)
    return res.status(403).json({ message: "Forbidden" });
  try {
    const meta = await SkillMeta.findOneAndUpdate(
      { userId: req.params.uid },
      { skills: req.body.skills },
      { upsert: true, new: true }
    );
    res.json(meta);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// POST /api/users/:uid/skills/:skillName/endorse  (must be authenticated, not own profile)
router.post("/users/:uid/skills/:skillName/endorse", requireAuth, async (req, res) => {
  if (req.user._id.toString() === req.params.uid)
    return res.status(400).json({ message: "Cannot endorse yourself" });
  try {
    const uid = toObjId(req.params.uid);
    if (!uid) return res.status(400).json({ message: "Invalid uid" });
    await SkillMeta.updateOne(
      { userId: uid, "skills.skillName": req.params.skillName },
      { $inc: { "skills.$.endorsements": 1 } }
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION PREFERENCES  (stored on User document)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/users/:uid/notif-prefs
router.get("/users/:uid/notif-prefs", requireAuth, async (req, res) => {
  if (req.user._id.toString() !== req.params.uid)
    return res.status(403).json({ message: "Forbidden" });
  try {
    const user = await User.findById(req.params.uid).select("notifPrefs").lean();
    res.json(user?.notifPrefs ?? { email: true, browser: false, inApp: true });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// PUT /api/users/:uid/notif-prefs
router.put("/users/:uid/notif-prefs", requireAuth, async (req, res) => {
  if (req.user._id.toString() !== req.params.uid)
    return res.status(403).json({ message: "Forbidden" });
  try {
    await User.findByIdAndUpdate(req.params.uid, { $set: { notifPrefs: req.body } });
    res.json(req.body);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

export default router;
