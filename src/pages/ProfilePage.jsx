/**
 * ProfilePage.jsx (redesigned layout)
 * - All logic, handlers, imports, services: 100% preserved
 * - Layout change: features are now prominent full-width sections
 *   with a sticky side-nav for quick jumping, not buried in a single tab row
 */

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
  Activity,
  Briefcase,
  ClipboardCheck,
  Bell,
  ChevronRight,
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
import {
  getSkillMeta,
  updateSkillMeta,
  endorseSkill,
  getNotifPrefs,
  updateNotifPrefs,
  getUserActivities,
} from "../services/profileFeatureService";
import UserAvatar from "../components/UserAvatar";
import { hasRealAvatar } from "../utils/avatar";

import ActivityTimeline from "../components/ActivityTimeline";
import AvailabilityCalendar from "../components/AvailabilityCalendar";
import PortfolioShowcase from "../components/PortfolioShowcase";
import EnhancedSkillBadge from "../components/EnhancedSkillBadge";
import ProfileCompletion from "../components/ProfileCompletion";
import PresenceIndicator from "../components/PresenceIndicator";

// ── helpers (unchanged) ───────────────────────────────────────────────────────

function formatJoinedDate(timestamp) {
  if (!timestamp) return "Recently";
  const date = typeof timestamp.toDate === "function" ? timestamp.toDate() : new Date(timestamp);
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

function joinSkills(skills = []) { return skills.join(", "); }
function parseSkills(value) {
  return value.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
}

function ActionButton({ onClick, disabled, children, isDark, variant = "primary" }) {
  const base = "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-[0.97]";
  if (variant === "primary") {
    return (
      <button onClick={onClick} disabled={disabled}
        className={`${base} ${isDark ? "bg-white text-black hover:bg-neutral-100" : "bg-[#e2593b] text-white hover:bg-[#d44a2e]"} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}>
        {children}
      </button>
    );
  }
  return (
    <button onClick={onClick} disabled={disabled}
      className={`${base} border ${isDark ? "border-white/10 hover:bg-white/[0.04] text-neutral-300" : "border-neutral-900/10 hover:bg-neutral-900/[0.04] text-neutral-700"} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}>
      {children}
    </button>
  );
}

// ── Section wrapper with anchor ───────────────────────────────────────────────
function ProfileSection({ id, icon: Icon, title, badge, accent = "text-[#e2593b]", isDark, children, action }) {
  return (
    <section
      id={id}
      className={`rounded-[24px] border transition-all duration-300 overflow-hidden ${
        isDark ? "bg-white/[0.01] border-white/[0.06]" : "bg-white border-neutral-200/60 shadow-sm"
      }`}
    >
      {/* Section header */}
      <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? "border-white/[0.05]" : "border-neutral-100"}`}>
        <div className="flex items-center gap-2.5">
          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${isDark ? "bg-white/[0.05]" : "bg-neutral-100"}`}>
            <Icon size={13} className={accent} />
          </span>
          <h2 className={`text-[11px] font-bold uppercase tracking-widest ${isDark ? "text-white" : "text-neutral-800"}`}>{title}</h2>
          {badge != null && (
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${isDark ? "bg-white/[0.07] text-neutral-300" : "bg-neutral-100 text-neutral-500"}`}>
              {badge}
            </span>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, value, label, accent, isDark }) {
  return (
    <div className={`flex flex-col gap-2 p-4 rounded-2xl border ${isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-neutral-50 border-neutral-200"}`}>
      <Icon size={15} className={accent} />
      <span className="text-2xl font-black tracking-tight leading-none">{value}</span>
      <span className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>{label}</span>
    </div>
  );
}

// ── Side nav pill ─────────────────────────────────────────────────────────────
function SideNav({ sections, isDark }) {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    const observers = sections.map(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return null;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActive(id); },
        { rootMargin: "-30% 0px -60% 0px" }
      );
      obs.observe(el);
      return obs;
    });
    return () => observers.forEach((o) => o?.disconnect());
  }, [sections]);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav className={`sticky top-6 flex flex-col gap-1 rounded-2xl border p-2 ${isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-white border-neutral-200 shadow-sm"}`}>
      {sections.map(({ id, label, icon: Icon, accent }) => (
        <button
          key={id}
          onClick={() => scrollTo(id)}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all text-[11px] font-bold uppercase tracking-wider ${
            active === id
              ? isDark
                ? "bg-white/[0.08] text-white"
                : "bg-[#e2593b]/10 text-[#e2593b]"
              : isDark
              ? "text-neutral-500 hover:text-white hover:bg-white/[0.04]"
              : "text-neutral-400 hover:text-neutral-800 hover:bg-neutral-50"
          }`}
        >
          <Icon size={12} className={active === id ? accent : ""} />
          {label}
          {active === id && <ChevronRight size={10} className="ml-auto opacity-50" />}
        </button>
      ))}
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const { id } = useParams();
  const fileInputRef = useRef(null);

  // ── core state (unchanged) ─────────────────────────────────────────────────
  const [edit, setEdit] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ name: "", location: "", bio: "", skillsOffered: "", skillsWanted: "", avatar: "" });

  const [targetProfile, setTargetProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(null);

  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState("");

  const [matches, setMatches] = useState([]);
  const [skillMetaMap, setSkillMetaMap] = useState({});
  const [activityCount, setActivityCount] = useState(0);
  const [notifPrefs, setNotifPrefs] = useState({ email: true, browser: false, inApp: true });
  const [savingNotif, setSavingNotif] = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  const isOwnProfile = !id || id === user?.uid;

  const displayProfile = useMemo(() => {
    if (isOwnProfile) return { ...profileFallback(user), ...(profile || {}) };
    return targetProfile || profileFallback(null);
  }, [isOwnProfile, user, profile, targetProfile]);

  // ── fetch target profile ───────────────────────────────────────────────────
  useEffect(() => {
    if (isOwnProfile) { setTargetProfile(null); setProfileError(null); return; }
    setProfileLoading(true);
    setProfileError(null);
    getUserProfile(id)
      .then((data) => { if (!data) setProfileError("User profile not found"); else setTargetProfile(data); })
      .catch((e) => setProfileError(e.message || "Failed to load profile"))
      .finally(() => setProfileLoading(false));
  }, [id, isOwnProfile]);

  useEffect(() => {
    if (!displayProfile?.uid) return;
    setReviewsLoading(true);
    getUserReviews(displayProfile.uid).then(setReviews).catch(console.error).finally(() => setReviewsLoading(false));
  }, [displayProfile?.uid]);

  useEffect(() => {
    if (!displayProfile?.uid) { setActivityCount(0); return; }
    getUserActivities(displayProfile.uid)
      .then((activities) => setActivityCount(activities.filter((a) => ["completed", "exchange_completed", "taught", "learned"].includes(a.type)).length))
      .catch(() => setActivityCount(0));
  }, [displayProfile?.uid]);

  useEffect(() => {
    if (!displayProfile?.uid) return;
    getSkillMeta(displayProfile.uid)
      .then((list) => {
        const map = {};
        list.forEach((m) => { map[m.skillName] = m; });
        setSkillMetaMap(map);
      })
      .catch(console.error);
  }, [displayProfile?.uid]);

  useEffect(() => {
    if (!isOwnProfile || !user?.uid) return;
    getNotifPrefs(user.uid).then(setNotifPrefs).catch(console.error);
  }, [isOwnProfile, user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeToMatches(user.uid, (m) => { setMatches(m); setMatchCount(m.length); });
  }, [user?.uid]);

  const activeMatch = useMemo(() => {
    if (!id || !user?.uid) return null;
    return matches.find((m) => m.users.includes(id));
  }, [matches, id, user?.uid]);

  const isMatched = !!activeMatch;

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

  // ── handlers (unchanged) ───────────────────────────────────────────────────
  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file."); return; }
    if (file.size > 3 * 1024 * 1024) { setError("Avatar image must be under 3 MB."); return; }
    setUploading(true); setError(""); setSaved(false);
    try {
      const updated = await uploadAvatar(file);
      setForm((c) => ({ ...c, avatar: updated.avatar || "" }));
      await refreshProfile();
      setSaved(true);
    } catch (e) {
      setError(e.message || "Could not upload photo.");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user?.uid || saving) return;
    setSaving(true); setError(""); setSaved(false);
    try {
      await updateUserProfile(user.uid, {
        name: form.name, location: form.location, bio: form.bio,
        skillsOffered: parseSkills(form.skillsOffered),
        skillsWanted: parseSkills(form.skillsWanted),
      });
      await refreshProfile();
      setEdit(false); setSaved(true);
    } catch (e) {
      setError(e.message || "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!displayProfile.uid || submittingReview) return;
    setSubmittingReview(true); setReviewError("");
    try {
      const savedReview = await createUserReview(displayProfile.uid, { rating: reviewRating, text: reviewText });
      const reviewer = { _id: user.uid, name: profile?.name || user.name || "You", avatar: profile?.avatar || user.avatar || "" };
      setReviews((prev) => {
        const filtered = prev.filter((r) => r.fromUser?._id !== user.uid && r.fromUser?.uid !== user.uid);
        return [{ ...savedReview, fromUser: reviewer }, ...filtered];
      });
      setReviewText(""); setShowReviewForm(false);
      if (!isOwnProfile) {
        const updated = await getUserProfile(id);
        if (updated) setTargetProfile(updated);
      }
    } catch (e) {
      setReviewError(e.message || "Failed to submit review.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleSkillMetaChange = async (skillName, meta) => {
    const allSkills = [...(displayProfile.skillsOffered || []), ...(displayProfile.skillsWanted || [])];
    const updatedList = allSkills.map((s) => s === skillName ? meta : (skillMetaMap[s] ?? { skillName: s, level: "Beginner", yearsExperience: 0, teachingStyle: [], certificationUrl: "", endorsements: 0 }));
    setSkillMetaMap((prev) => ({ ...prev, [skillName]: meta }));
    await updateSkillMeta(user.uid, updatedList).catch(console.error);
  };

  const handleEndorse = async (skillName) => {
    if (!displayProfile.uid) return;
    await endorseSkill(displayProfile.uid, skillName).catch(console.error);
    setSkillMetaMap((prev) => ({
      ...prev,
      [skillName]: { ...(prev[skillName] ?? {}), endorsements: ((prev[skillName]?.endorsements) ?? 0) + 1 },
    }));
  };

  const handleNotifSave = async (prefs) => {
    setSavingNotif(true);
    await updateNotifPrefs(user.uid, prefs).catch(console.error);
    setNotifPrefs(prefs);
    setSavingNotif(false);
  };

  const inputClasses = `px-3.5 py-2.5 text-sm font-medium rounded-xl border outline-none transition-all ${
    isDark
      ? "bg-neutral-900 text-white border-white/10 placeholder:text-neutral-500 focus:border-[#e2593b]"
      : "bg-white text-neutral-900 border-neutral-300 placeholder:text-neutral-500 focus:border-[#e2593b]"
  }`;
  const textareaClasses = `${inputClasses} min-h-[90px] resize-none`;

  // ── nav sections ──────────────────────────────────────────────────────────
  const NAV_SECTIONS = [
    { id: "sec-overview",    label: "Overview",    icon: Users,         accent: "text-blue-500" },
    ...(isOwnProfile ? [{ id: "sec-completion", label: "Progress",  icon: ClipboardCheck, accent: "text-[#e2593b]" }] : []),
    { id: "sec-skills",     label: "Skills",      icon: Award,         accent: "text-amber-500" },
    { id: "sec-portfolio",  label: "Portfolio",   icon: Briefcase,     accent: "text-indigo-500" },
    { id: "sec-activity",   label: "Activity",    icon: Activity,      accent: "text-emerald-500" },
    { id: "sec-schedule",   label: "Schedule",    icon: Calendar,      accent: "text-cyan-500" },
    { id: "sec-reviews",    label: "Reviews",     icon: Star,          accent: "text-amber-500" },
    ...(isOwnProfile ? [{ id: "sec-settings",   label: "Settings",    icon: Bell,          accent: "text-purple-500" }] : []),
  ];

  // ── loading / error / auth gates ──────────────────────────────────────────
  if (loading || profileLoading) {
    return (
      <div className={`flex-1 h-screen flex items-center justify-center ${isDark ? "bg-[#0b0b0b]" : "bg-[#fcfcfc]"}`}>
        <Loader2 className="animate-spin text-[#e2593b]" size={36} />
      </div>
    );
  }
  if (profileError) {
    return (
      <div className={`flex-1 h-screen flex items-center justify-center px-6 ${isDark ? "bg-[#0b0b0b] text-white" : "bg-[#fcfcfc] text-neutral-900"}`}>
        <div className={`text-center max-w-sm p-8 rounded-[32px] border ${isDark ? "border-white/[0.06] bg-white/[0.01]" : "border-neutral-200 shadow-xl"}`}>
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center mx-auto mb-5 text-rose-500"><X size={22} /></div>
          <h1 className="text-2xl font-black tracking-tight mb-2">Profile Error</h1>
          <p className={`text-xs font-medium leading-relaxed mb-6 ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>{profileError}</p>
          <button onClick={() => navigate(-1)} className={`w-full py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 ${isDark ? "bg-white text-black" : "bg-[#e2593b] text-white"}`}>Go Back</button>
        </div>
      </div>
    );
  }
  if (!user) {
    return (
      <div className={`flex-1 h-screen flex items-center justify-center px-6 ${isDark ? "bg-[#0b0b0b] text-white" : "bg-[#fcfcfc] text-neutral-900"}`}>
        <div className={`text-center max-w-sm p-8 rounded-[32px] border ${isDark ? "border-white/[0.06] bg-white/[0.01]" : "border-neutral-200 shadow-xl"}`}>
          <div className="w-12 h-12 rounded-2xl bg-[#e2593b]/10 flex items-center justify-center mx-auto mb-5 text-[#e2593b]"><Sparkles size={22} /></div>
          <h1 className="text-2xl font-black tracking-tight mb-2">Sign in to profile</h1>
          <p className={`text-xs font-medium leading-relaxed mb-6 ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>Log in to update your profile, skills, and learning goals.</p>
          <button onClick={() => navigate("/login")} className={`w-full py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 ${isDark ? "bg-white text-black" : "bg-[#e2593b] text-white"}`}>
            <LogIn size={14} /> Go to Login
          </button>
        </div>
      </div>
    );
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className={`flex-1 overflow-y-auto transition-colors duration-300 border-t ${isDark ? "bg-[#0b0b0b] text-white border-white/[0.04]" : "bg-[#f5f5f5] text-neutral-900 border-neutral-200"}`}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        <div className="flex gap-6 items-start">

          {/* ── STICKY SIDE NAV (desktop only) ─────────────────────────────── */}
          <aside className="hidden lg:block w-44 shrink-0">
            <SideNav sections={NAV_SECTIONS} isDark={isDark} />
          </aside>

          {/* ── MAIN CONTENT ───────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* ══════════════════════════════════
                SECTION 1 — HERO / OVERVIEW
            ══════════════════════════════════ */}
            <section
              id="sec-overview"
              className={`overflow-hidden rounded-[28px] border transition-all duration-300 ${isDark ? "bg-white/[0.01] border-white/[0.06] shadow-xl shadow-black/30" : "bg-white border-neutral-200/60 shadow-sm"}`}
            >
              {/* Color bar */}
              <div className="h-1 bg-gradient-to-r from-[#e2593b] via-indigo-500 to-cyan-400" />

              <div className="p-6 md:p-8">
                {/* Top row: avatar + identity + actions */}
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    {/* Avatar */}
                    <div className="relative w-fit shrink-0">
                      <UserAvatar
                        user={{ ...displayProfile, avatar: form.avatar || displayProfile.avatar }}
                        size="2xl"
                        className={`ring-4 ${isDark ? "ring-[#0b0b0b]" : "ring-white"} rounded-[22px]`}
                      />
                      {isOwnProfile && (
                        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                          className={`absolute bottom-[-4px] right-[-4px] w-8 h-8 rounded-xl flex items-center justify-center border shadow-lg transition-transform active:scale-90 ${isDark ? "bg-white border-neutral-200 text-black hover:bg-neutral-100" : "bg-white border-neutral-200 text-neutral-900 hover:bg-neutral-50"}`}>
                          {uploading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
                        </button>
                      )}
                      <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                    </div>

                    {/* Name + meta */}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-2xl font-black tracking-tight uppercase">{displayProfile.name}</h1>
                        {hasRealAvatar(displayProfile.avatar) && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            <Check size={10} /> Verified
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium">
                        <span className={`flex items-center gap-1.5 ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
                          <MapPin size={12} className="text-[#e2593b]" />
                          {displayProfile.location || "Location not set"}
                        </span>
                        <span className={`flex items-center gap-1.5 ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
                          <Calendar size={12} className={isDark ? "text-neutral-500" : "text-neutral-400"} />
                          Joined {formatJoinedDate(displayProfile.createdAt)}
                        </span>
                      </div>
                      <div className="mt-2">
                        <PresenceIndicator uid={displayProfile.uid} isOwnProfile={isOwnProfile} isDark={isDark} />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {isOwnProfile ? (
                      edit ? (
                        <>
                          <ActionButton onClick={() => { setEdit(false); setError(""); }} isDark={isDark} variant="secondary"><X size={13} /> Cancel</ActionButton>
                          <ActionButton onClick={handleSave} disabled={saving} isDark={isDark} variant="primary">
                            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
                          </ActionButton>
                        </>
                      ) : (
                        <ActionButton onClick={() => { setEdit(true); setSaved(false); setError(""); }} isDark={isDark} variant="primary">
                          <Edit3 size={13} /> Edit profile
                        </ActionButton>
                      )
                    ) : (
                      <>
                        {isMatched && (
                          <>
                            <ActionButton onClick={() => navigate(`/chat?matchId=${activeMatch.id}`)} isDark={isDark} variant="primary">
                              <MessageSquare size={13} /> Message
                            </ActionButton>
                            <ActionButton onClick={() => setShowReviewForm(!showReviewForm)} isDark={isDark} variant="secondary">
                              <Star size={13} /> {showReviewForm ? "Close" : "Review"}
                            </ActionButton>
                          </>
                        )}
                        {!isMatched && (
                          <ActionButton onClick={() => navigate("/swipe")} isDark={isDark} variant="secondary">
                            Go to Discover
                          </ActionButton>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Bio / edit form */}
                <div className="mt-6">
                  {edit ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="flex flex-col gap-1.5">
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>Name</span>
                        <input value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} className={inputClasses} maxLength={80} />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>Location</span>
                        <input value={form.location} onChange={(e) => setForm((c) => ({ ...c, location: e.target.value }))} className={inputClasses} maxLength={100} />
                      </label>
                      <label className="flex flex-col gap-1.5 md:col-span-2">
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>Bio</span>
                        <textarea value={form.bio} onChange={(e) => setForm((c) => ({ ...c, bio: e.target.value }))} className={`${inputClasses} min-h-[80px] resize-none`} maxLength={500} />
                      </label>
                    </div>
                  ) : (
                    <p className={`text-sm leading-relaxed max-w-2xl ${isDark ? "text-neutral-300" : "text-neutral-600"}`}>
                      {displayProfile.bio || "No bio yet. Add a short note about what you teach and what you want to learn."}
                    </p>
                  )}

                  <AnimatePresence>
                    {(error || saved) && (
                      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
                        className={`mt-4 p-3.5 rounded-xl text-xs font-medium flex items-center gap-2 border ${error ? "bg-rose-500/10 text-rose-500 border-rose-500/20" : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"}`}>
                        {error ? <X size={14} /> : <Check size={14} />}
                        <span className="font-mono">{error || "Profile saved."}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Stats row */}
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatCard icon={Users} value={String(isOwnProfile ? matchCount : (displayProfile.matchCount || 0))} label="Matches" accent="text-blue-500" isDark={isDark} />
                  <StatCard icon={Star} value={displayProfile.rating > 0 ? displayProfile.rating.toFixed(1) : "0.0"} label="Rating" accent="text-amber-500" isDark={isDark} />
                  <StatCard icon={TrendingUp} value={String(displayProfile.reviewCount || 0)} label="Reviews" accent="text-emerald-500" isDark={isDark} />
                  <StatCard icon={Activity} value={String(activityCount)} label="Exchanges" accent="text-[#e2593b]" isDark={isDark} />
                </div>
              </div>
            </section>

            {/* ══════════════════════════════════
                SECTION 2 — PROFILE COMPLETION
                (own profile only)
            ══════════════════════════════════ */}
            {isOwnProfile && (
              <ProfileSection
                id="sec-completion"
                icon={ClipboardCheck}
                title="Profile completeness"
                accent="text-[#e2593b]"
                isDark={isDark}
              >
                <ProfileCompletion profile={displayProfile} isDark={isDark} activityCount={activityCount} />
              </ProfileSection>
            )}

            {/* ══════════════════════════════════
                SECTION 3 — SKILLS
            ══════════════════════════════════ */}
            <ProfileSection
              id="sec-skills"
              icon={Award}
              title="Skills"
              badge={`${(displayProfile.skillsOffered?.length || 0) + (displayProfile.skillsWanted?.length || 0)} total`}
              accent="text-amber-500"
              isDark={isDark}
              action={
                isOwnProfile && edit && (
                  <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg ${isDark ? "bg-white/[0.05] text-neutral-400" : "bg-neutral-100 text-neutral-500"}`}>
                    Editing below
                  </span>
                )
              }
            >
              {edit ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#e2593b] flex items-center gap-1">
                      <Award size={11} /> Can Teach
                    </span>
                    <textarea value={form.skillsOffered} onChange={(e) => setForm((c) => ({ ...c, skillsOffered: e.target.value }))} className={textareaClasses} placeholder="React, Python, Shell Scripting" />
                    <span className={`text-[10px] ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>Comma-separated</span>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-1">
                      <BookOpen size={11} /> Wants To Learn
                    </span>
                    <textarea value={form.skillsWanted} onChange={(e) => setForm((c) => ({ ...c, skillsWanted: e.target.value }))} className={textareaClasses} placeholder="Queuing Theory, Rust, UI Design" />
                    <span className={`text-[10px] ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>Comma-separated</span>
                  </label>
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <p className={`mb-3 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
                      <Award size={10} className="text-[#e2593b]" /> Can teach
                      <span className={`ml-auto font-bold px-1.5 py-0.5 rounded ${isDark ? "bg-white/[0.05] text-neutral-400" : "bg-neutral-100 text-neutral-500"}`}>
                        {displayProfile.skillsOffered?.length || 0}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(displayProfile.skillsOffered || []).length === 0 ? (
                        <p className={`text-xs font-medium font-mono ${isDark ? "text-white/20" : "text-neutral-400"}`}>No teaching skills yet.</p>
                      ) : (
                        displayProfile.skillsOffered.map((skill) => (
                          <EnhancedSkillBadge key={skill} skillName={skill} meta={skillMetaMap[skill]} variant="offered"
                            isOwnProfile={isOwnProfile} isMatched={isMatched} isDark={isDark}
                            onMetaChange={handleSkillMetaChange} onEndorse={handleEndorse} />
                        ))
                      )}
                    </div>
                  </div>
                  <div>
                    <p className={`mb-3 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
                      <BookOpen size={10} className="text-indigo-400" /> Wants to learn
                      <span className={`ml-auto font-bold px-1.5 py-0.5 rounded ${isDark ? "bg-white/[0.05] text-neutral-400" : "bg-neutral-100 text-neutral-500"}`}>
                        {displayProfile.skillsWanted?.length || 0}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(displayProfile.skillsWanted || []).length === 0 ? (
                        <p className={`text-xs font-medium font-mono ${isDark ? "text-white/20" : "text-neutral-400"}`}>No learning goals yet.</p>
                      ) : (
                        displayProfile.skillsWanted.map((skill) => (
                          <EnhancedSkillBadge key={skill} skillName={skill} meta={skillMetaMap[skill]} variant="wanted"
                            isOwnProfile={isOwnProfile} isMatched={isMatched} isDark={isDark}
                            onMetaChange={handleSkillMetaChange} onEndorse={handleEndorse} />
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </ProfileSection>

            {/* ══════════════════════════════════
                SECTION 4 — PORTFOLIO
            ══════════════════════════════════ */}
            <ProfileSection
              id="sec-portfolio"
              icon={Briefcase}
              title="Portfolio"
              accent="text-indigo-500"
              isDark={isDark}
            >
              <PortfolioShowcase uid={displayProfile.uid} isOwnProfile={isOwnProfile} isDark={isDark} />
            </ProfileSection>

            {/* ══════════════════════════════════
                SECTION 5 — ACTIVITY
            ══════════════════════════════════ */}
            <ProfileSection
              id="sec-activity"
              icon={Activity}
              title="Activity"
              badge={activityCount > 0 ? `${activityCount} exchanges` : null}
              accent="text-emerald-500"
              isDark={isDark}
            >
              <ActivityTimeline uid={displayProfile.uid} isOwnProfile={isOwnProfile} isDark={isDark} />
            </ProfileSection>

            {/* ══════════════════════════════════
                SECTION 6 — SCHEDULE
            ══════════════════════════════════ */}
            <ProfileSection
              id="sec-schedule"
              icon={Calendar}
              title="Availability & Schedule"
              accent="text-cyan-500"
              isDark={isDark}
            >
              <AvailabilityCalendar
                uid={displayProfile.uid}
                targetUid={isOwnProfile ? null : displayProfile.uid}
                isOwnProfile={isOwnProfile}
                isMatched={isMatched}
                isDark={isDark}
                matchId={activeMatch?.id}
              />
            </ProfileSection>

            {/* ══════════════════════════════════
                SECTION 7 — REVIEWS
            ══════════════════════════════════ */}
            <ProfileSection
              id="sec-reviews"
              icon={Star}
              title="Reviews"
              badge={reviews.length > 0 ? `${reviews.length}` : null}
              accent="text-amber-500"
              isDark={isDark}
              action={
                !isOwnProfile && isMatched && (
                  <button
                    onClick={() => setShowReviewForm(!showReviewForm)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                      isDark ? "bg-white/[0.06] hover:bg-white/[0.1] text-white" : "bg-neutral-100 hover:bg-neutral-200 text-neutral-700"
                    }`}
                  >
                    <Star size={10} /> {showReviewForm ? "Close" : "Write review"}
                  </button>
                )
              }
            >
              {/* Review form */}
              <AnimatePresence>
                {showReviewForm && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-5">
                    <form onSubmit={handleReviewSubmit} className={`p-5 rounded-2xl border space-y-4 ${isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-neutral-50 border-neutral-200"}`}>
                      <div className="flex flex-col gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>Rating</span>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button key={star} type="button" onClick={() => setReviewRating(star)} className="transition-transform active:scale-90">
                              <Star size={20} className={star <= reviewRating ? "fill-amber-500 text-amber-500" : "text-neutral-400"} />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>Review</span>
                        <textarea required value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="Describe your session..." className={`${textareaClasses} min-h-[90px]`} />
                      </div>
                      {reviewError && <p className="text-xs text-rose-500 font-medium">{reviewError}</p>}
                      <div className="flex justify-end gap-2">
                        <ActionButton onClick={() => setShowReviewForm(false)} isDark={isDark} variant="secondary">Cancel</ActionButton>
                        <button type="submit" disabled={submittingReview}
                          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-[0.97] ${isDark ? "bg-white text-black hover:bg-neutral-100" : "bg-[#e2593b] text-white hover:bg-[#d44a2e]"} ${submittingReview ? "opacity-50 cursor-not-allowed" : ""}`}>
                          {submittingReview ? <Loader2 size={13} className="animate-spin" /> : "Submit Review"}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Review list */}
              {reviewsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-[#e2593b]" size={20} /></div>
              ) : reviews.length === 0 ? (
                <div className={`py-10 text-center rounded-2xl border border-dashed ${isDark ? "border-white/[0.06] text-white/30" : "border-neutral-200 text-neutral-400"}`}>
                  <div className="w-9 h-9 rounded-xl bg-neutral-500/10 flex items-center justify-center mb-3 opacity-60 mx-auto"><TrendingUp size={14} /></div>
                  <p className="text-xs font-medium">No reviews yet.</p>
                  <p className={`text-[10px] font-medium mt-1 ${isDark ? "text-neutral-600" : "text-neutral-500"}`}>
                    {isOwnProfile ? "Reviews appear after completed skill exchanges." : `Be the first to review ${displayProfile.name}!`}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reviews.map((rev) => (
                    <div key={rev._id || rev.id} className={`p-4 rounded-2xl border transition-all ${isDark ? "bg-white/[0.01] border-white/[0.06]" : "bg-neutral-50 border-neutral-200"}`}>
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
                        <div className="flex items-center gap-0.5">
                          {[...Array(5)].map((_, i) => <Star key={i} size={12} className={i < rev.rating ? "fill-amber-500 text-amber-500" : "text-neutral-400"} />)}
                        </div>
                      </div>
                      <p className={`mt-3 text-xs leading-relaxed ${isDark ? "text-neutral-300" : "text-neutral-600"}`}>{rev.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </ProfileSection>

            {/* ══════════════════════════════════
                SECTION 8 — SETTINGS / NOTIFS
                (own profile only)
            ══════════════════════════════════ */}
            {isOwnProfile && (
              <ProfileSection
                id="sec-settings"
                icon={Bell}
                title="Notification settings"
                accent="text-purple-500"
                isDark={isDark}
              >
                <div className="flex flex-wrap gap-6">
                  {[["email", "Email notifications"], ["browser", "Browser push"], ["inApp", "In-app alerts"]].map(([key, label]) => (
                    <label key={key} className={`flex items-center gap-3 cursor-pointer p-3 rounded-xl border transition-all ${
                      notifPrefs[key]
                        ? isDark ? "bg-white/[0.04] border-white/[0.12]" : "bg-neutral-50 border-neutral-300"
                        : isDark ? "border-white/[0.05]" : "border-neutral-200"
                    }`}>
                      <input
                        type="checkbox"
                        checked={notifPrefs[key]}
                        onChange={(e) => {
                          const updated = { ...notifPrefs, [key]: e.target.checked };
                          setNotifPrefs(updated);
                          handleNotifSave(updated);
                        }}
                        className="accent-[#e2593b] w-3.5 h-3.5"
                      />
                      <span className={`text-xs font-semibold ${isDark ? "text-neutral-300" : "text-neutral-700"}`}>{label}</span>
                      {savingNotif && <Loader2 size={11} className="animate-spin text-[#e2593b]" />}
                    </label>
                  ))}
                </div>
                <p className={`mt-4 text-[10px] font-medium ${isDark ? "text-neutral-600" : "text-neutral-400"}`}>
                  Changes save automatically.
                </p>
              </ProfileSection>
            )}

            <div className="h-4" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  );
}
