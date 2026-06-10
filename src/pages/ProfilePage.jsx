import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  Sparkles,
  BookOpen,
  Award,
  MessageSquare,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { subscribeToMatches } from "../services/matchService";
import {
  updateUserProfile,
  uploadAvatar,
  getUserProfile,
  getUserReviews,
  createUserReview,
} from "../services/userService";
import SkillBadge from "../components/SkillBadge";
import UserAvatar from "../components/UserAvatar";
import { hasRealAvatar } from "../utils/avatar";

function StatCard({ icon: Icon, value, label, tone = "text-[#e2593b]", isDark }) {
  return (
    <div className={`rounded-2xl border p-5 transition-all duration-300 ${
      isDark 
        ? "bg-white/[0.01] border-white/[0.06] shadow-md shadow-black/20" 
        : "bg-neutral-900/[0.01] border-neutral-900/[0.06] shadow-sm"
    }`}>
      <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl ${
        isDark ? "bg-white/[0.03]" : "bg-neutral-900/[0.03]"
      } ${tone}`}>
        <Icon size={16} />
      </div>
      <div className="text-2xl font-black tracking-tight leading-none">{value}</div>
      <div className={`mt-2 text-[10px] font-bold uppercase tracking-widest ${
        isDark ? "text-neutral-500" : "text-neutral-400"
      }`}>
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
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const { id } = useParams();
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

  const [targetProfile, setTargetProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(null);

  // Reviews State
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  // Review Form State
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState("");

  const isOwnProfile = !id || id === user?.uid;

  const displayProfile = useMemo(() => {
    if (isOwnProfile) {
      return { ...profileFallback(user), ...(profile || {}) };
    }
    return targetProfile || profileFallback(null);
  }, [isOwnProfile, user, profile, targetProfile]);

  useEffect(() => {
    if (isOwnProfile) {
      setTargetProfile(null);
      setProfileError(null);
      return;
    }

    async function fetchTargetProfile() {
      setProfileLoading(true);
      setProfileError(null);
      try {
        const data = await getUserProfile(id);
        if (!data) {
          setProfileError("User profile not found");
        } else {
          setTargetProfile(data);
        }
      } catch (err) {
        setProfileError(err.message || "Failed to load profile");
      } finally {
        setProfileLoading(false);
      }
    }

    fetchTargetProfile();
  }, [id, isOwnProfile]);

  useEffect(() => {
    if (!displayProfile?.uid) return;

    async function loadReviews() {
      setReviewsLoading(true);
      try {
        const list = await getUserReviews(displayProfile.uid);
        setReviews(list);
      } catch (err) {
        console.error("Failed to load reviews:", err);
      } finally {
        setReviewsLoading(false);
      }
    }

    loadReviews();
  }, [displayProfile?.uid]);

  const [matches, setMatches] = useState([]);

  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = subscribeToMatches(user.uid, (nextMatches) => {
      setMatches(nextMatches);
      setMatchCount(nextMatches.length);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const activeMatch = useMemo(() => {
    if (!id || !user?.uid) return null;
    return matches.find((m) => m.users.includes(id));
  }, [matches, id, user?.uid]);

  const isMatched = !!activeMatch;

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!displayProfile.uid || submittingReview) return;

    setSubmittingReview(true);
    setReviewError("");

    try {
      const savedReview = await createUserReview(displayProfile.uid, {
        rating: reviewRating,
        text: reviewText,
      });

      const reviewer = {
        _id: user.uid,
        name: profile?.name || user.name || "You",
        avatar: profile?.avatar || user.avatar || "",
      };

      const populatedReview = {
        ...savedReview,
        fromUser: reviewer,
      };

      setReviews((prev) => {
        const filtered = prev.filter((r) => r.fromUser?._id !== user.uid && r.fromUser?.uid !== user.uid);
        return [populatedReview, ...filtered];
      });

      setReviewText("");
      setShowReviewForm(false);

      if (!isOwnProfile) {
        const updatedProfile = await getUserProfile(id);
        if (updatedProfile) setTargetProfile(updatedProfile);
      }
    } catch (err) {
      setReviewError(err.message || "Failed to submit review");
    } finally {
      setSubmittingReview(false);
    }
  };

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

  if (loading || profileLoading) {
    return (
      <div className={`flex-1 h-screen flex items-center justify-center transition-colors duration-300 ${isDark ? "bg-[#0b0b0b]" : "bg-[#fcfcfc]"}`}>
        <Loader2 className="animate-spin text-[#e2593b]" size={36} />
      </div>
    );
  }

  if (profileError) {
    return (
      <div className={`flex-1 h-screen flex items-center justify-center px-6 transition-colors duration-300 ${isDark ? "bg-[#0b0b0b] text-white" : "bg-[#fcfcfc] text-neutral-900"}`}>
        <div className={`text-center max-w-sm p-8 rounded-[32px] border ${isDark ? "border-white/[0.06] bg-white/[0.01]" : "border-neutral-900/[0.06] bg-neutral-900/[0.01] shadow-xl"}`}>
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center mx-auto mb-5 text-rose-500">
            <X size={22} />
          </div>
          <h1 className="text-2xl font-black tracking-tight mb-2">Profile Error</h1>
          <p className={`text-xs font-medium leading-relaxed mb-6 ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
            {profileError}
          </p>
          <button
            onClick={() => navigate(-1)}
            className={`w-full py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-transform active:scale-[0.98] ${
              isDark ? "bg-white text-black hover:bg-neutral-100" : "bg-neutral-950 text-white hover:bg-neutral-800"
            }`}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`flex-1 h-screen flex items-center justify-center px-6 transition-colors duration-300 ${isDark ? "bg-[#0b0b0b] text-white" : "bg-[#fcfcfc] text-neutral-900"}`}>
        <div className={`text-center max-w-sm p-8 rounded-[32px] border ${isDark ? "border-white/[0.06] bg-white/[0.01]" : "border-neutral-900/[0.06] bg-neutral-900/[0.01] shadow-xl"}`}>
          <div className="w-12 h-12 rounded-2xl bg-[#e2593b]/10 flex items-center justify-center mx-auto mb-5 text-[#e2593b]">
            <Sparkles size={22} />
          </div>
          <h1 className="text-2xl font-black tracking-tight mb-2">Sign in to profile</h1>
          <p className={`text-xs font-medium leading-relaxed mb-6 ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
            Log in to update your profile, skills, and learning goals.
          </p>
          <button
            onClick={() => navigate("/login")}
            className={`w-full py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-transform active:scale-[0.98] ${
              isDark ? "bg-white text-black hover:bg-neutral-100" : "bg-neutral-950 text-white hover:bg-neutral-800"
            }`}
          >
            <LogIn size={14} />
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex-1 min-h-0 overflow-y-auto transition-colors duration-300 border-t ${
      isDark ? "bg-[#0b0b0b] text-white border-white/[0.04]" : "bg-[#fcfcfc] text-neutral-900 border-neutral-900/[0.04]"
    }`}>
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-6">
        
        {/* CORE PROFILE PLINTH MODULE */}
        <section className={`overflow-hidden rounded-[32px] border transition-all duration-300 ${
          isDark ? "bg-white/[0.01] border-white/[0.06] shadow-xl shadow-black/40" : "bg-neutral-900/[0.01] border-neutral-900/[0.06] shadow-sm"
        }`}>
          {/* Subtle accent line for profile identity. */}
          <div className="h-[4px] bg-gradient-to-r from-[#e2593b] via-indigo-500 to-cyan-500" />
          
          <div className="p-6 md:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="relative w-fit shrink-0">
                  <UserAvatar
                    user={{ ...displayProfile, avatar: form.avatar || displayProfile.avatar }}
                    size="2xl"
                    className={`ring-4 ${isDark ? "ring-[#0b0b0b]" : "ring-[#fcfcfc]"} rounded-[24px]`}
                  />
                  {isOwnProfile && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className={`absolute bottom-[-4px] right-[-4px] w-8 h-8 rounded-xl flex items-center justify-center border shadow-lg transition-transform active:scale-90 ${
                        isDark ? "bg-white border-neutral-200 text-black hover:bg-neutral-100" : "bg-neutral-950 border-neutral-800 text-white hover:bg-neutral-800"
                      }`}
                      title="Upload profile photo"
                    >
                      {uploading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="text-2xl font-black tracking-tight uppercase tracking-wide">{displayProfile.name}</h1>
                    {hasRealAvatar(displayProfile.avatar) && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        <Check size={10} />
                        Verified Face
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-medium">
                    <p className={`flex items-center gap-1.5 ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
                      <MapPin size={13} className="text-[#e2593b]" />
                      {displayProfile.location || "Cluster Coordinate Unset"}
                    </p>
                    <p className={`flex items-center gap-1.5 ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
                      <Calendar size={13} className={isDark ? "text-neutral-500" : "text-neutral-400"} />
                      Joined {formatJoinedDate(displayProfile.createdAt)}
                    </p>
                  </div>
                </div>
              </div>

              {/* ACTION TOGGLES */}
              <div className="flex flex-wrap gap-2">
                {isOwnProfile ? (
                  edit ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEdit(false);
                          setError("");
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border flex items-center gap-1.5 transition-all active:scale-[0.97] ${
                          isDark ? "border-white/10 hover:bg-white/[0.04] text-neutral-300" : "border-neutral-900/10 hover:bg-neutral-900/[0.04] text-neutral-700"
                        }`}
                      >
                        <X size={13} />
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-[0.97] ${
                          isDark ? "bg-white text-black hover:bg-neutral-100" : "bg-neutral-950 text-white hover:bg-neutral-800"
                        }`}
                      >
                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
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
                      className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-[0.97] ${
                        isDark ? "bg-white text-black hover:bg-neutral-100" : "bg-neutral-950 text-white hover:bg-neutral-800"
                      }`}
                    >
                      <Edit3 size={13} />
                      Edit profile
                    </button>
                  )
                ) : (
                  <>
                    {isMatched && (
                      <>
                        <button
                          type="button"
                          onClick={() => navigate(`/chat?matchId=${activeMatch.id}`)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-[0.97] ${
                            isDark ? "bg-white text-black hover:bg-neutral-100" : "bg-neutral-950 text-white hover:bg-neutral-800"
                          }`}
                        >
                          <MessageSquare size={13} />
                          Message
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowReviewForm(!showReviewForm)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border flex items-center gap-1.5 transition-all active:scale-[0.97] ${
                            isDark 
                              ? "border-white/10 hover:bg-white/[0.04] text-neutral-300" 
                              : "border-neutral-900/10 hover:bg-neutral-900/[0.04] text-neutral-700"
                          }`}
                        >
                          <Star size={13} />
                          {showReviewForm ? "Close Review" : "Write Review"}
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* FORM FIELD STRUCTURAL GRIDS */}
            <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_280px]">
              <div className="min-w-0">
                {edit ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="flex flex-col gap-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>Identity Label</span>
                      <input
                        value={form.name}
                        onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                        className={`px-3.5 py-2.5 text-xs font-medium border rounded-xl outline-none transition-all ${
                          isDark 
                            ? "bg-white/[0.02] border-white/[0.06] focus:border-white/25 text-white" 
                            : "bg-neutral-900/[0.02] border-neutral-900/[0.06] focus:border-neutral-900/25 text-neutral-900"
                        }`}
                        maxLength={80}
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>Geographic Sector</span>
                      <input
                        value={form.location}
                        onChange={(e) => setForm((current) => ({ ...current, location: e.target.value }))}
                        className={`px-3.5 py-2.5 text-xs font-medium border rounded-xl outline-none transition-all ${
                          isDark 
                            ? "bg-white/[0.02] border-white/[0.06] focus:border-white/25 text-white" 
                            : "bg-neutral-900/[0.02] border-neutral-900/[0.06] focus:border-neutral-900/25 text-neutral-900"
                        }`}
                        maxLength={100}
                      />
                    </label>
                    <label className="flex flex-col gap-1.5 md:col-span-2">
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>Biography Blueprint</span>
                      <textarea
                        value={form.bio}
                        onChange={(e) => setForm((current) => ({ ...current, bio: e.target.value }))}
                        className={`px-3.5 py-2.5 text-xs font-medium border rounded-xl outline-none transition-all min-h-[80px] resize-none ${
                          isDark 
                            ? "bg-white/[0.02] border-white/[0.06] focus:border-white/25 text-white" 
                            : "bg-neutral-900/[0.02] border-neutral-900/[0.06] focus:border-neutral-900/25 text-neutral-900"
                        }`}
                        maxLength={500}
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#e2593b] flex items-center gap-1">
                        <Award size={11} /> Outbound Capabilities (Can Teach)
                      </span>
                      <textarea
                        value={form.skillsOffered}
                        onChange={(e) => setForm((current) => ({ ...current, skillsOffered: e.target.value }))}
                        className={`px-3.5 py-2.5 text-xs font-medium border rounded-xl outline-none transition-all min-h-[90px] resize-none placeholder-neutral-500 ${
                          isDark 
                            ? "bg-white/[0.02] border-white/[0.06] focus:border-white/25 text-white" 
                            : "bg-neutral-900/[0.02] border-neutral-900/[0.06] focus:border-neutral-900/25 text-neutral-900"
                        }`}
                        placeholder="React, Assembly, Shell Scripting"
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-1">
                        <BookOpen size={11} /> Inbound Demands (Wants To Learn)
                      </span>
                      <textarea
                        value={form.skillsWanted}
                        onChange={(e) => setForm((current) => ({ ...current, skillsWanted: e.target.value }))}
                        className={`px-3.5 py-2.5 text-xs font-medium border rounded-xl outline-none transition-all min-h-[90px] resize-none placeholder-neutral-500 ${
                          isDark 
                            ? "bg-white/[0.02] border-white/[0.06] focus:border-white/25 text-white" 
                            : "bg-neutral-900/[0.02] border-neutral-900/[0.06] focus:border-neutral-900/25 text-neutral-900"
                        }`}
                        placeholder="Queuing Theory, Python, UI Design"
                      />
                    </label>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <h4 className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>Biography Summary</h4>
                    <p className={`text-xs font-medium leading-relaxed max-w-2xl ${isDark ? "text-neutral-300" : "text-neutral-600"}`}>
                      {displayProfile.bio || "No bio yet. Add a short note about what you teach and what you want to learn."}
                    </p>
                  </div>
                )}

                <AnimatePresence>
                  {(error || saved) && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      className={`mt-4 p-3.5 rounded-xl text-xs font-medium flex items-center gap-2 border ${
                        error 
                          ? "bg-rose-500/10 text-rose-500 border-rose-500/20" 
                          : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                      }`}
                    >
                      {error ? <X size={14} /> : <Check size={14} />}
                      <span className="font-mono">{error || "System logs updated successfully."}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* FLOATING ACTION MINI PANEL */}
              {isOwnProfile ? (
                <div className={`p-4 rounded-2xl border flex flex-col justify-between transition-all ${
                  isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-neutral-900/[0.02] border-neutral-900/[0.06]"
                }`}>
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-[#e2593b]/10 text-[#e2593b] shrink-0">
                      <Upload size={14} />
                    </div>
                    <div>
                      <p className="text-xs font-bold tracking-tight uppercase tracking-wider">Profile photo</p>
                      <p className={`text-[10px] font-medium mt-0.5 leading-normal ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
                        JPG, PNG, or WebP architecture footprints matching under 3 MB bounds.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className={`mt-4 w-full py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all active:scale-95 flex items-center justify-center gap-2 ${
                      isDark ? "border-white/10 hover:bg-white/[0.04] text-white" : "border-neutral-900/10 hover:bg-neutral-900/[0.04] text-neutral-950"
                    }`}
                  >
                    {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                    Upload image
                  </button>
                </div>
              ) : (
                <div className={`p-4 rounded-2xl border flex flex-col justify-between transition-all ${
                  isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-neutral-900/[0.02] border-neutral-900/[0.06]"
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-xl shrink-0 ${isMatched ? "bg-emerald-500/10 text-emerald-500" : "bg-blue-500/10 text-blue-500"}`}>
                      <Users size={14} />
                    </div>
                    <div>
                      <p className="text-xs font-bold tracking-tight uppercase tracking-wider">Connection</p>
                      <p className={`text-[10px] font-medium mt-0.5 leading-normal ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
                        {isMatched 
                          ? `You are connected with ${displayProfile.name}. You can chat and exchange skills!`
                          : `Discover and like ${displayProfile.name} on the discover page to match.`
                        }
                      </p>
                    </div>
                  </div>
                  {isMatched ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/chat?matchId=${activeMatch.id}`)}
                      className={`mt-4 w-full py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all active:scale-95 flex items-center justify-center gap-2 ${
                        isDark ? "border-white/10 hover:bg-white/[0.04] text-white" : "border-neutral-900/10 hover:bg-neutral-900/[0.04] text-neutral-950"
                      }`}
                    >
                      <MessageSquare size={12} />
                      Chat Now
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => navigate("/swipe")}
                      className={`mt-4 w-full py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all active:scale-95 flex items-center justify-center gap-2 ${
                        isDark ? "border-white/10 hover:bg-white/[0.04] text-white" : "border-neutral-900/10 hover:bg-neutral-900/[0.04] text-neutral-950"
                      }`}
                    >
                      Go to Discover
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* CLUSTER INTELLIGENCE STATS MATRIX */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard icon={Users} value={String(isOwnProfile ? matchCount : (displayProfile.matchCount || 0))} label="Skill matches" tone="text-blue-500" isDark={isDark} />
          <StatCard icon={Upload} value={hasRealAvatar(displayProfile.avatar) ? "Added" : "Missing"} label="Photo" tone="text-cyan-500" isDark={isDark} />
          <StatCard icon={Star} value={displayProfile.rating > 0 ? displayProfile.rating.toFixed(1) : "0.0"} label="Rating" tone="text-amber-500" isDark={isDark} />
          <StatCard icon={TrendingUp} value={String(displayProfile.reviewCount || 0)} label="Reviews" tone="text-emerald-500" isDark={isDark} />
        </div>

        {/* REVIEW SUBMIT FORM */}
        <AnimatePresence>
          {showReviewForm && (
            <motion.section
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <form
                onSubmit={handleReviewSubmit}
                className={`p-6 rounded-[24px] border space-y-4 ${
                  isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-neutral-900/[0.02] border-neutral-900/[0.06]"
                }`}
              >
                <h3 className="text-sm font-black uppercase tracking-widest text-[#e2593b]">Write a Review</h3>
                
                <div className="flex flex-col gap-2">
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>Rating</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewRating(star)}
                        className="transition-transform active:scale-90 text-amber-500"
                      >
                        <Star
                          size={20}
                          className={star <= reviewRating ? "fill-amber-500" : "text-neutral-400"}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>Review Details</span>
                  <textarea
                    required
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    placeholder="Describe your learning session or collaboration experience..."
                    className={`px-3.5 py-2.5 text-xs font-medium border rounded-xl outline-none transition-all min-h-[90px] resize-none ${
                      isDark 
                        ? "bg-white/[0.02] border-white/[0.06] focus:border-white/25 text-white" 
                        : "bg-neutral-900/[0.02] border-neutral-900/[0.06] focus:border-neutral-900/25 text-neutral-900"
                    }`}
                  />
                </div>

                {reviewError && (
                  <p className="text-xs text-rose-500 font-medium">{reviewError}</p>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowReviewForm(false)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all active:scale-[0.97] ${
                      isDark ? "border-white/10 hover:bg-white/[0.04] text-neutral-300" : "border-neutral-900/10 hover:bg-neutral-900/[0.04] text-neutral-700"
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-[0.97] ${
                      isDark ? "bg-white text-black hover:bg-neutral-100" : "bg-neutral-950 text-white hover:bg-neutral-800"
                    }`}
                  >
                    {submittingReview ? <Loader2 size={13} className="animate-spin" /> : "Submit Review"}
                  </button>
                </div>
              </form>
            </motion.section>
          )}
        </AnimatePresence>

        {/* TABS DIRECTORY STRUCTURE BLOCK */}
        <section className={`rounded-[24px] border p-5 transition-all duration-300 ${
          isDark ? "bg-white/[0.01] border-white/[0.06]" : "bg-neutral-900/[0.01] border-neutral-900/[0.06]"
        }`}>
          <div className="mb-6 flex gap-1.5 p-1 rounded-xl w-fit bg-transparent">
            {["skills", "reviews"].map((item) => (
              <button
                key={item}
                onClick={() => setTab(item)}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all duration-200 ${
                  tab === item 
                    ? isDark 
                      ? "bg-white text-black shadow-md shadow-black/20" 
                      : "bg-neutral-950 text-white shadow-sm"
                    : isDark
                      ? "text-neutral-400 hover:text-white hover:bg-white/[0.03]"
                      : "text-neutral-500 hover:text-neutral-950 hover:bg-neutral-900/[0.03]"
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
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="grid gap-6 md:grid-cols-2"
              >
                <div>
                  <p className={`mb-3 text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
                    Can teach
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(displayProfile.skillsOffered || []).length === 0 ? (
                      <p className={`text-xs font-medium font-mono ${isDark ? "text-white/20" : "text-neutral-400"}`}>No teaching skills yet.</p>
                    ) : (
                      displayProfile.skillsOffered.map((skill) => (
                        <SkillBadge key={skill} skill={skill} variant="offered" />
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <p className={`mb-3 text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
                    Wants to learn
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(displayProfile.skillsWanted || []).length === 0 ? (
                      <p className={`text-xs font-medium font-mono ${isDark ? "text-white/20" : "text-neutral-400"}`}>No learning goals yet.</p>
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
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="space-y-4"
              >
                {reviewsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="animate-spin text-[#e2593b]" size={20} />
                  </div>
                ) : reviews.length === 0 ? (
                  <div className={`py-12 text-center rounded-2xl border border-dashed flex flex-col items-center justify-center ${
                    isDark ? "border-white/[0.06] text-white/30" : "border-neutral-900/[0.06] text-neutral-400"
                  }`}>
                    <div className="w-9 h-9 rounded-xl bg-neutral-500/10 flex items-center justify-center mb-3 opacity-60">
                      <TrendingUp size={14} />
                    </div>
                    <p className="text-xs font-medium">No reviews yet.</p>
                    <p className={`text-[10px] font-medium mt-1 ${isDark ? "text-neutral-600" : "text-neutral-400"}`}>
                      {isOwnProfile 
                        ? "Reviews can be added after completed skill exchanges."
                        : `Be the first to review your skill exchange with ${displayProfile.name}!`
                      }
                    </p>
                  </div>
                ) : (
                  reviews.map((rev) => (
                    <div
                      key={rev._id || rev.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        isDark ? "bg-white/[0.01] border-white/[0.06]" : "bg-neutral-900/[0.01] border-neutral-900/[0.06]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <UserAvatar user={rev.fromUser} size="md" className="rounded-lg shrink-0" />
                          <div>
                            <p className="text-xs font-bold">{rev.fromUser?.name || "Member"}</p>
                            <p className={`text-[9px] font-medium ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
                              {new Date(rev.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 text-amber-500">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              size={12}
                              className={i < rev.rating ? "fill-amber-500" : "text-neutral-400"}
                            />
                          ))}
                        </div>
                      </div>
                      <p className={`mt-3 text-xs leading-relaxed ${isDark ? "text-neutral-300" : "text-neutral-600"}`}>
                        {rev.text}
                      </p>
                    </div>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </div>
  );
}
