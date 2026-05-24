import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Calendar,
  Check,
  Edit3,
  LogIn,
  Loader2,
  MapPin,
  Save,
  Star,
  TrendingUp,
  Upload,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { subscribeToMatches } from "../services/matchService";
import { updateUserProfile, uploadAvatar } from "../services/userService";
import SkillBadge from "../components/SkillBadge";
import UserAvatar, { hasRealAvatar } from "../components/UserAvatar";

function StatCard({ icon: Icon, value, label, tone = "text-primary" }) {
  return (
    <div className="rounded-2xl border border-base-300/70 bg-base-100 p-4 shadow-sm">
      <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-base-200 ${tone}`}>
        <Icon size={18} />
      </div>
      <div className="text-2xl font-bold leading-none">{value}</div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-base-content/45">
        {label}
      </div>
    </div>
  );
}

function formatJoinedDate(timestamp) {
  if (!timestamp) return "Recently";

  const date =
    typeof timestamp.toDate === "function"
      ? timestamp.toDate()
      : new Date(timestamp);

  if (Number.isNaN(date.getTime())) return "Recently";

  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function profileFallback(user) {
  return {
    uid: user?.uid,
    name: user?.name || user?.displayName || user?.email?.split("@")[0] || "User",
    email: user?.email || "",
    avatar: user?.avatar || "",
    bio: "",
    location: "",
    skillsOffered: [],
    skillsWanted: [],
    createdAt: user?.createdAt,
  };
}

function joinSkills(skills = []) {
  return skills.join(", ");
}

function parseSkills(value) {
  return value
    .split(/[,\n]/)
    .map((skill) => skill.trim())
    .filter(Boolean);
}

export default function ProfilePage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [tab, setTab] = useState("skills");
  const [edit, setEdit] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: "",
    location: "",
    bio: "",
    skillsOffered: "",
    skillsWanted: "",
    avatar: "",
  });

  const displayProfile = useMemo(
    () => ({ ...profileFallback(user), ...(profile || {}) }),
    [profile, user]
  );

  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = subscribeToMatches(user.uid, (matches) => {
      setMatchCount(matches.length);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    setForm({
      name: displayProfile.name || "",
      location: displayProfile.location || "",
      bio: displayProfile.bio || "",
      skillsOffered: joinSkills(displayProfile.skillsOffered),
      skillsWanted: joinSkills(displayProfile.skillsWanted),
      avatar: displayProfile.avatar || "",
    });
  }, [displayProfile]);

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setError("Avatar image must be under 3 MB.");
      return;
    }

    setUploading(true);
    setError("");
    setSaved(false);

    try {
      const updated = await uploadAvatar(file);
      setForm((current) => ({ ...current, avatar: updated.avatar || "" }));
      await refreshProfile();
      setSaved(true);
    } catch (uploadError) {
      setError(uploadError.message || "Could not upload photo.");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user?.uid || saving) return;

    setSaving(true);
    setError("");
    setSaved(false);

    try {
      await updateUserProfile(user.uid, {
        name: form.name,
        location: form.location,
        bio: form.bio,
        skillsOffered: parseSkills(form.skillsOffered),
        skillsWanted: parseSkills(form.skillsWanted),
      });
      await refreshProfile();
      setEdit(false);
      setSaved(true);
    } catch (saveError) {
      setError(saveError.message || "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <Loader2 className="animate-spin text-primary" size={36} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-2xl border border-base-300 bg-base-100 p-8 text-center shadow-xl"
        >
          <h1 className="text-2xl font-bold mb-2">You are not logged in</h1>
          <p className="text-base-content/60 mb-6">
            Please login to view your profile.
          </p>
          <button
            onClick={() => navigate("/login")}
            className="btn btn-primary w-full flex items-center gap-2 justify-center"
          >
            <LogIn size={18} />
            Go to Login
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-xl">
          <div className="h-28 bg-gradient-to-r from-slate-950 via-indigo-700 to-cyan-500" />
          <div className="px-6 pb-6">
            <div className="-mt-16 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="relative w-fit">
                  <UserAvatar
                    user={{ ...displayProfile, avatar: form.avatar || displayProfile.avatar }}
                    size="2xl"
                    className="ring-4 ring-base-100"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="btn btn-circle btn-sm absolute bottom-1 right-1 bg-base-100 shadow-md"
                    title="Upload photo"
                  >
                    {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                </div>

                <div className="min-w-0 pb-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-3xl font-bold leading-tight">{displayProfile.name}</h1>
                    {hasRealAvatar(displayProfile.avatar) && (
                      <span className="badge badge-success gap-1">
                        <Check size={12} />
                        Photo
                      </span>
                    )}
                  </div>

                  <p className="mt-1 flex items-center gap-2 text-sm text-base-content/60">
                    <MapPin size={14} />
                    {displayProfile.location || "No location"}
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-sm text-base-content/60">
                    <Calendar size={14} />
                    Joined {formatJoinedDate(displayProfile.createdAt)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {edit ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setEdit(false);
                        setError("");
                      }}
                      className="btn btn-outline btn-sm gap-2"
                    >
                      <X size={14} />
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      className="btn btn-vibrant-primary btn-sm gap-2"
                    >
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Save
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEdit(true);
                      setSaved(false);
                      setError("");
                    }}
                    className="btn btn-vibrant-primary btn-sm gap-2"
                  >
                    <Edit3 size={14} />
                    Edit Profile
                  </button>
                )}
              </div>
            </div>

            <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_320px]">
              <div>
                {edit ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="form-control">
                      <span className="label-text mb-1 font-medium">Name</span>
                      <input
                        value={form.name}
                        onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                        className="input input-bordered"
                        maxLength={80}
                      />
                    </label>
                    <label className="form-control">
                      <span className="label-text mb-1 font-medium">Location</span>
                      <input
                        value={form.location}
                        onChange={(e) => setForm((current) => ({ ...current, location: e.target.value }))}
                        className="input input-bordered"
                        maxLength={100}
                      />
                    </label>
                    <label className="form-control md:col-span-2">
                      <span className="label-text mb-1 font-medium">Bio</span>
                      <textarea
                        value={form.bio}
                        onChange={(e) => setForm((current) => ({ ...current, bio: e.target.value }))}
                        className="textarea textarea-bordered min-h-24"
                        maxLength={500}
                      />
                    </label>
                    <label className="form-control">
                      <span className="label-text mb-1 font-medium">Can teach</span>
                      <textarea
                        value={form.skillsOffered}
                        onChange={(e) => setForm((current) => ({ ...current, skillsOffered: e.target.value }))}
                        className="textarea textarea-bordered min-h-24"
                        placeholder="React, Excel, Photography"
                      />
                    </label>
                    <label className="form-control">
                      <span className="label-text mb-1 font-medium">Wants to learn</span>
                      <textarea
                        value={form.skillsWanted}
                        onChange={(e) => setForm((current) => ({ ...current, skillsWanted: e.target.value }))}
                        className="textarea textarea-bordered min-h-24"
                        placeholder="Public speaking, Python, Design"
                      />
                    </label>
                  </div>
                ) : (
                  <p className="max-w-2xl text-sm leading-6 text-base-content/70">
                    {displayProfile.bio || "No bio yet"}
                  </p>
                )}

                <AnimatePresence>
                  {(error || saved) && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className={`mt-4 alert ${error ? "alert-error" : "alert-success"}`}
                    >
                      {error ? <X size={18} /> : <Check size={18} />}
                      <span>{error || "Profile updated"}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="rounded-2xl border border-base-300 bg-base-200/70 p-4">
                <div className="flex items-center gap-3">
                  <Upload className="text-primary" size={20} />
                  <div>
                    <p className="font-semibold">Profile photo</p>
                    <p className="text-xs text-base-content/55">
                      JPG, PNG, or WebP under 3 MB.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="btn btn-outline btn-sm mt-4 w-full gap-2"
                >
                  {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                  Upload Photo
                </button>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard icon={Users} value={String(matchCount)} label="Matches" tone="text-blue-500" />
          <StatCard icon={Upload} value={hasRealAvatar(displayProfile.avatar) ? "Yes" : "No"} label="Photo" tone="text-cyan-500" />
          <StatCard icon={Star} value="5.0" label="Rating" tone="text-amber-500" />
          <StatCard icon={TrendingUp} value="0" label="Reviews" tone="text-green-500" />
        </div>

        <section className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm">
          <div className="mb-5 flex gap-2">
            {["skills", "reviews"].map((item) => (
              <button
                key={item}
                onClick={() => setTab(item)}
                className={`btn btn-sm rounded-xl ${
                  tab === item ? "btn-primary" : "btn-ghost bg-base-200"
                }`}
              >
                {item === "skills" ? "Skills" : "Reviews"}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {tab === "skills" && (
              <motion.div
                key="skills"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="grid gap-6 md:grid-cols-2"
              >
                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-wide text-base-content/45">
                    Can teach
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(displayProfile.skillsOffered || []).length === 0 ? (
                      <p className="text-sm text-base-content/50">No skills listed yet</p>
                    ) : (
                      displayProfile.skillsOffered.map((skill) => (
                        <SkillBadge key={skill} skill={skill} variant="offered" />
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-wide text-base-content/45">
                    Wants to learn
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(displayProfile.skillsWanted || []).length === 0 ? (
                      <p className="text-sm text-base-content/50">No skills listed yet</p>
                    ) : (
                      displayProfile.skillsWanted.map((skill) => (
                        <SkillBadge key={skill} skill={skill} variant="wanted" />
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {tab === "reviews" && (
              <motion.div
                key="reviews"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="py-8 text-center text-base-content/50"
              >
                <p>No reviews yet. Complete skill sessions to receive feedback.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </div>
  );
}
