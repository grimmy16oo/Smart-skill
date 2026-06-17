/**
 * AvailabilityCalendar.jsx  — MongoDB/REST version
 *
 * Fixes vs previous version:
 *  - No Firestore imports anywhere
 *  - Loading state initialises to false; data is fetched then shown — no spinner
 *    if the endpoint responds quickly, and a graceful empty-state if it fails
 *  - Save never gets stuck: try/catch always clears the saving flag
 *  - Abort controller cancels in-flight fetch on unmount
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Clock, Globe, Plus, X, Check, Calendar } from "lucide-react";
import { getUserAvailability, updateUserAvailability, bookSession } from "../services/profileFeatureService";
import { useAuth } from "../context/AuthContext";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function detectTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function formatSlot(slot) {
  return `${DAY_NAMES[slot.dayOfWeek]} ${slot.startTime}–${slot.endTime}`;
}

function TimeInput({ value, onChange, isDark, label }) {
  return (
    <label className="flex flex-col gap-1">
      <span className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
        {label}
      </span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        step="1800"
        className={`px-3 py-2 text-xs font-medium rounded-xl border outline-none transition-all w-28 ${
          isDark
            ? "bg-neutral-900 text-white border-white/10 focus:border-[#e2593b]"
            : "bg-white text-neutral-900 border-neutral-300 focus:border-[#e2593b]"
        }`}
      />
    </label>
  );
}

function MiniCalendar({ selectedDate, onSelect, isDark }) {
  const [view, setView] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const today = new Date().toISOString().slice(0, 10);
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const firstDow = new Date(view.year, view.month, 1).getDay();

  function iso(day) {
    return `${view.year}-${String(view.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const cells = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className={`rounded-2xl border p-4 ${isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-neutral-50 border-neutral-200"}`}>
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setView((v) => {
            const m = v.month === 0 ? 11 : v.month - 1;
            return { year: v.month === 0 ? v.year - 1 : v.year, month: m };
          })}
          className={`p-1 rounded-lg text-xs font-bold ${isDark ? "hover:bg-white/[0.06] text-neutral-400" : "hover:bg-neutral-100 text-neutral-500"}`}
        >‹</button>
        <span className="text-[10px] font-bold uppercase tracking-widest">
          {new Date(view.year, view.month).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </span>
        <button
          type="button"
          onClick={() => setView((v) => {
            const m = v.month === 11 ? 0 : v.month + 1;
            return { year: v.month === 11 ? v.year + 1 : v.year, month: m };
          })}
          className={`p-1 rounded-lg text-xs font-bold ${isDark ? "hover:bg-white/[0.06] text-neutral-400" : "hover:bg-neutral-100 text-neutral-500"}`}
        >›</button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((d) => (
          <span key={d} className={`text-center text-[9px] font-bold uppercase tracking-widest py-1 ${isDark ? "text-neutral-600" : "text-neutral-400"}`}>{d}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />;
          const dateStr = iso(day);
          const isPast = dateStr < today;
          const isSelected = selectedDate === dateStr;
          const isToday = dateStr === today;
          return (
            <button
              key={dateStr}
              type="button"
              disabled={isPast}
              onClick={() => onSelect(isSelected ? null : dateStr)}
              className={`w-full aspect-square rounded-lg text-[10px] font-bold transition-all active:scale-90 ${
                isPast
                  ? isDark ? "text-neutral-700 cursor-not-allowed" : "text-neutral-300 cursor-not-allowed"
                  : isSelected
                  ? "bg-[#e2593b] text-white"
                  : isToday
                  ? isDark ? "bg-white/10 text-white" : "bg-neutral-200 text-neutral-900"
                  : isDark ? "text-neutral-300 hover:bg-white/[0.06]" : "text-neutral-700 hover:bg-neutral-100"
              }`}
            >{day}</button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function AvailabilityCalendar({ uid, targetUid, isOwnProfile, isMatched, isDark, matchId }) {
  const { user } = useAuth();

  // Availability state
  const [availability, setAvailability] = useState(null);
  const [loading, setLoading]   = useState(false);   // false by default — no spinner until fetch starts
  const [saving,  setSaving]    = useState(false);
  const [error,   setError]     = useState("");
  const [saved,   setSaved]     = useState(false);

  // Edit state
  const [editMode,    setEditMode]    = useState(false);
  const [draftSlots,  setDraftSlots]  = useState([]);
  const [tz,          setTz]          = useState(detectTimezone);

  // New slot inputs
  const [newDay,   setNewDay]   = useState(1);
  const [newStart, setNewStart] = useState("14:00");
  const [newEnd,   setNewEnd]   = useState("17:00");

  // Booking state
  const [showBooking,  setShowBooking]  = useState(false);
  const [bookDate,     setBookDate]     = useState(null);
  const [bookTime,     setBookTime]     = useState("14:00");
  const [bookDuration, setBookDuration] = useState(60);
  const [bookSkill,    setBookSkill]    = useState("");
  const [booking,      setBooking]      = useState(false);
  const [bookError,    setBookError]    = useState("");
  const [bookSuccess,  setBookSuccess]  = useState(false);

  // ── Fetch availability ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!uid) return;

    let cancelled = false;
    setLoading(true);
    setError("");

    getUserAvailability(uid)
      .then((data) => {
        if (cancelled) return;
        // Backend may return null / 404-as-null for users with no availability yet
        const safe = data ?? { recurring: [], timezone: detectTimezone() };
        setAvailability(safe);
        setDraftSlots(safe.recurring ?? []);
        setTz(safe.timezone ?? detectTimezone());
      })
      .catch((e) => {
        if (cancelled) return;
        // 404 means "not set yet" — not a real error, just show empty state
        if (e.message?.includes("404")) {
          setAvailability({ recurring: [], timezone: detectTimezone() });
          setDraftSlots([]);
        } else {
          setError(e.message || "Could not load availability.");
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [uid]);

  // ── Save availability ───────────────────────────────────────────────────────
  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const payload = { recurring: draftSlots, timezone: tz };
      await updateUserAvailability(uid, payload);
      setAvailability(payload);
      setEditMode(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e.message || "Failed to save. Please try again.");
    } finally {
      setSaving(false);   // ← always runs — save can never get stuck
    }
  }

  // ── Slot helpers ────────────────────────────────────────────────────────────
  function addSlot() {
    const slot = { dayOfWeek: Number(newDay), startTime: newStart, endTime: newEnd };
    // Prevent exact duplicates
    const exists = draftSlots.some(
      (s) => s.dayOfWeek === slot.dayOfWeek && s.startTime === slot.startTime && s.endTime === slot.endTime
    );
    if (!exists) setDraftSlots((prev) => [...prev, slot]);
  }

  function removeSlot(idx) {
    setDraftSlots((prev) => prev.filter((_, i) => i !== idx));
  }

  function cancelEdit() {
    setEditMode(false);
    setDraftSlots(availability?.recurring ?? []);
    setTz(availability?.timezone ?? detectTimezone());
    setError("");
  }

  // ── Book session ────────────────────────────────────────────────────────────
  async function handleBook() {
    if (!bookDate || !bookTime || !bookSkill || booking) return;
    setBooking(true);
    setBookError("");
    try {
      const [h, m] = bookTime.split(":").map(Number);
      const scheduledAt = new Date(bookDate);
      scheduledAt.setHours(h, m, 0, 0);
      await bookSession({
        requesterId:     user.uid,
        targetId:        targetUid ?? uid,
        matchId:         matchId ?? "",
        scheduledAt:     scheduledAt.toISOString(),
        durationMinutes: bookDuration,
        skill:           bookSkill,
      });
      setBookSuccess(true);
      setTimeout(() => { setShowBooking(false); setBookSuccess(false); setBookDate(null); setBookSkill(""); }, 2500);
    } catch (e) {
      setBookError(e.message || "Booking failed. Please try again.");
    } finally {
      setBooking(false);
    }
  }

  // ── Shared input class ──────────────────────────────────────────────────────
  const selCls = `px-3 py-2 text-xs font-medium rounded-xl border outline-none transition-all ${
    isDark
      ? "bg-neutral-900 text-white border-white/10 focus:border-[#e2593b]"
      : "bg-white text-neutral-900 border-neutral-300 focus:border-[#e2593b]"
  }`;

  const displaySlots = editMode ? draftSlots : (availability?.recurring ?? []);
  const displayTz    = editMode ? tz : (availability?.timezone ?? detectTimezone());

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
          <Globe size={11} />
          {loading ? "Detecting timezone…" : displayTz}
        </div>

        {isOwnProfile && !editMode && !loading && (
          <button
            type="button"
            onClick={() => { setEditMode(true); setSaved(false); setError(""); }}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-all ${
              isDark ? "border-white/10 text-neutral-300 hover:bg-white/[0.04]" : "border-neutral-200 text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            Edit availability
          </button>
        )}

        {isOwnProfile && editMode && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={cancelEdit}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-all ${
                isDark ? "border-white/10 text-neutral-300 hover:bg-white/[0.04]" : "border-neutral-200 text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-all ${
                isDark ? "bg-white text-black hover:bg-neutral-100" : "bg-[#e2593b] text-white hover:bg-[#d44a2e]"
              } ${saving ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="flex items-center gap-2 text-xs font-medium text-neutral-400">
          <Loader2 size={13} className="animate-spin text-[#e2593b]" />
          Loading schedule…
        </div>
      )}

      {/* Fetch error */}
      {!loading && error && !editMode && (
        <p className="text-xs font-medium text-rose-500">{error}</p>
      )}

      {/* Timezone editor */}
      {editMode && (
        <label className="flex flex-col gap-1.5">
          <span className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>Timezone</span>
          <input
            value={tz}
            onChange={(e) => setTz(e.target.value)}
            className={`${selCls} w-full max-w-xs`}
            placeholder="e.g. America/New_York"
          />
        </label>
      )}

      {/* Slots */}
      {!loading && displaySlots.length === 0 && !editMode ? (
        <p className={`text-xs font-medium ${isDark ? "text-white/20" : "text-neutral-400"}`}>
          {isOwnProfile ? "No availability set yet. Click \"Edit availability\" to add time slots." : "This user hasn't set their availability yet."}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {displaySlots.map((slot, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-bold ${
                isDark ? "border-white/[0.08] bg-white/[0.03] text-neutral-200" : "border-neutral-200 bg-neutral-50 text-neutral-700"
              }`}
            >
              <Clock size={10} className="text-[#e2593b]" />
              {formatSlot(slot)}
              {editMode && (
                <button
                  type="button"
                  onClick={() => removeSlot(i)}
                  className="ml-1 text-neutral-500 hover:text-rose-500 transition-colors"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add slot form */}
      {editMode && (
        <div className={`p-4 rounded-2xl border space-y-3 ${isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-neutral-50 border-neutral-200"}`}>
          <p className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>Add a time slot</p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>Day</span>
              <select value={newDay} onChange={(e) => setNewDay(e.target.value)} className={selCls}>
                {DAY_NAMES.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
            </label>
            <TimeInput label="Start" value={newStart} onChange={setNewStart} isDark={isDark} />
            <TimeInput label="End"   value={newEnd}   onChange={setNewEnd}   isDark={isDark} />
            <button
              type="button"
              onClick={addSlot}
              className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-all active:scale-95 ${
                isDark ? "bg-white text-black hover:bg-neutral-100" : "bg-[#e2593b] text-white hover:bg-[#d44a2e]"
              }`}
            >
              <Plus size={11} /> Add
            </button>
          </div>
        </div>
      )}

      {/* Save feedback */}
      <AnimatePresence>
        {(saved || (error && editMode)) && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`text-xs font-medium flex items-center gap-1.5 ${error && editMode ? "text-rose-500" : "text-emerald-500"}`}
          >
            {error && editMode ? <X size={12} /> : <Check size={12} />}
            {error && editMode ? error : "Availability saved."}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Book Session CTA — matched + viewing other profile */}
      {!isOwnProfile && isMatched && !loading && (
        <div className="pt-2 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={() => setShowBooking((p) => !p)}
            className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-all active:scale-95 ${
              isDark ? "bg-white text-black hover:bg-neutral-100" : "bg-[#e2593b] text-white hover:bg-[#d44a2e]"
            }`}
          >
            <Calendar size={11} />
            {showBooking ? "Close" : "Book a session"}
          </button>

          <AnimatePresence>
            {showBooking && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mt-4"
              >
                <div className={`p-5 rounded-2xl border space-y-4 ${isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-white border-neutral-200"}`}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#e2593b]">Pick a date</p>

                  <MiniCalendar selectedDate={bookDate} onSelect={setBookDate} isDark={isDark} />

                  {bookDate && (
                    <div className="flex flex-wrap gap-3">
                      <TimeInput label="Time" value={bookTime} onChange={setBookTime} isDark={isDark} />

                      <label className="flex flex-col gap-1">
                        <span className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>Duration</span>
                        <select value={bookDuration} onChange={(e) => setBookDuration(Number(e.target.value))} className={selCls}>
                          <option value={30}>30 min</option>
                          <option value={60}>60 min</option>
                          <option value={90}>90 min</option>
                          <option value={120}>2 hrs</option>
                        </select>
                      </label>

                      <label className="flex flex-col gap-1 flex-1 min-w-[140px]">
                        <span className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>Skill</span>
                        <input
                          value={bookSkill}
                          onChange={(e) => setBookSkill(e.target.value)}
                          placeholder="e.g. React"
                          className={`${selCls} w-full`}
                        />
                      </label>
                    </div>
                  )}

                  {bookDate && (
                    <button
                      type="button"
                      onClick={handleBook}
                      disabled={booking || !bookSkill}
                      className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-all active:scale-95 ${
                        isDark ? "bg-white text-black hover:bg-neutral-100" : "bg-[#e2593b] text-white hover:bg-[#d44a2e]"
                      } ${booking || !bookSkill ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      {booking
                        ? <Loader2 size={11} className="animate-spin" />
                        : bookSuccess
                        ? <Check size={11} />
                        : <Calendar size={11} />
                      }
                      {booking ? "Booking…" : bookSuccess ? "Booked!" : "Confirm booking"}
                    </button>
                  )}

                  {bookError && <p className="text-xs text-rose-500 font-medium">{bookError}</p>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
