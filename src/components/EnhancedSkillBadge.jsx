/**
 * EnhancedSkillBadge.jsx
 * Skill badge that shows level, years of experience, teaching style, cert link,
 * and endorsement count.  Editable on own profile.
 *
 * Props:
 *  - skillName    {string}
 *  - meta         {SkillMeta|undefined}
 *  - variant      {'offered'|'wanted'}
 *  - isOwnProfile {boolean}
 *  - isMatched    {boolean}   — allow endorsing if matched
 *  - isDark       {boolean}
 *  - onMetaChange {(skillName:string, meta:SkillMeta) => void}  — for own profile
 *  - onEndorse    {(skillName:string) => void}                  — for matched users
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, ChevronDown, Check, ThumbsUp } from "lucide-react";

const LEVELS = ["Beginner", "Intermediate", "Expert"];
const TEACHING_STYLES = ["Project-based", "Theory-first", "Code-along", "Documentation"];

const LEVEL_COLORS = {
  Beginner: "text-blue-500",
  Intermediate: "text-amber-500",
  Expert: "text-emerald-500",
};

const VARIANT_STYLES = {
  offered: {
    badge: "bg-[#e2593b]/10 text-[#e2593b] border-[#e2593b]/20",
    dot: "bg-[#e2593b]",
  },
  wanted: {
    badge: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    dot: "bg-indigo-500",
  },
};

export default function EnhancedSkillBadge({
  skillName,
  meta,
  variant = "offered",
  isOwnProfile,
  isMatched,
  isDark,
  onMetaChange,
  onEndorse,
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(
    meta ?? {
      skillName,
      level: "Beginner",
      yearsExperience: 0,
      teachingStyle: [],
      certificationUrl: "",
      endorsements: 0,
    }
  );
  const [endorsed, setEndorsed] = useState(false);

  const styles = VARIANT_STYLES[variant];

  function toggleStyle(style) {
    setDraft((d) => ({
      ...d,
      teachingStyle: d.teachingStyle.includes(style)
        ? d.teachingStyle.filter((s) => s !== style)
        : [...d.teachingStyle, style],
    }));
  }

  function handleSave() {
    onMetaChange?.(skillName, { ...draft, skillName });
    setEditing(false);
    setOpen(false);
  }

  function handleEndorse() {
    if (endorsed || !isMatched || isOwnProfile) return;
    setEndorsed(true);
    onEndorse?.(skillName);
  }

  const inputCls = `px-2.5 py-1.5 text-xs font-medium rounded-lg border outline-none transition-all w-full ${
    isDark
      ? "bg-neutral-900 text-white border-white/10 focus:border-[#e2593b]"
      : "bg-white text-neutral-900 border-neutral-300 focus:border-[#e2593b]"
  }`;

  const current = editing ? draft : (meta ?? draft);

  return (
    <div className="relative">
      {/* Pill */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-widest transition-all active:scale-95 ${styles.badge}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${styles.dot}`} />
        {skillName}
        {meta?.endorsements > 0 && (
          <span className={`ml-0.5 text-[9px] font-bold opacity-60`}>+{meta.endorsements}</span>
        )}
        <ChevronDown size={9} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Popover */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -4 }}
            transition={{ duration: 0.15 }}
            className={`absolute z-50 top-full mt-2 left-0 min-w-[220px] rounded-2xl border shadow-xl p-4 space-y-3 ${
              isDark ? "bg-[#111] border-white/[0.08] text-white" : "bg-white border-neutral-200 text-neutral-900"
            }`}
          >
            {/* Skill name header */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-black tracking-tight">{skillName}</span>
              <button
                onClick={() => setOpen(false)}
                className={`p-1 rounded-lg transition-colors ${isDark ? "text-neutral-500 hover:text-white hover:bg-white/[0.06]" : "text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100"}`}
              >
                ×
              </button>
            </div>

            {/* Level */}
            <div className="space-y-1.5">
              <span className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>Level</span>
              {editing ? (
                <div className="flex gap-1">
                  {LEVELS.map((l) => (
                    <button
                      key={l}
                      onClick={() => setDraft((d) => ({ ...d, level: l }))}
                      className={`flex-1 py-1 rounded-lg text-[9px] font-bold border transition-all ${
                        draft.level === l
                          ? isDark ? "bg-white text-black border-white" : "bg-[#e2593b] text-white border-[#e2593b]"
                          : isDark ? "border-white/10 text-neutral-400 hover:bg-white/[0.04]" : "border-neutral-200 text-neutral-500 hover:bg-neutral-100"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              ) : (
                <span className={`text-xs font-bold ${LEVEL_COLORS[current.level] ?? "text-neutral-400"}`}>
                  {current.level || "—"}
                </span>
              )}
            </div>

            {/* Years of experience */}
            <div className="space-y-1.5">
              <span className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>Experience</span>
              {editing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={20}
                    value={draft.yearsExperience}
                    onChange={(e) => setDraft((d) => ({ ...d, yearsExperience: Number(e.target.value) }))}
                    className="flex-1 accent-[#e2593b]"
                  />
                  <span className={`text-[10px] font-bold min-w-[28px] text-right ${isDark ? "text-neutral-300" : "text-neutral-700"}`}>
                    {draft.yearsExperience}yr
                  </span>
                </div>
              ) : (
                <span className={`text-xs font-medium ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>
                  {current.yearsExperience > 0 ? `${current.yearsExperience} year${current.yearsExperience !== 1 ? "s" : ""}` : "—"}
                </span>
              )}
            </div>

            {/* Teaching styles */}
            {variant === "offered" && (
              <div className="space-y-1.5">
                <span className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>Teaching style</span>
                {editing ? (
                  <div className="flex flex-wrap gap-1">
                    {TEACHING_STYLES.map((s) => (
                      <button
                        key={s}
                        onClick={() => toggleStyle(s)}
                        className={`px-2 py-0.5 rounded-full text-[9px] font-bold border transition-all ${
                          draft.teachingStyle.includes(s)
                            ? isDark ? "bg-white/10 border-white/20 text-white" : "bg-neutral-900 border-neutral-900 text-white"
                            : isDark ? "border-white/[0.06] text-neutral-500 hover:border-white/10" : "border-neutral-200 text-neutral-400 hover:border-neutral-300"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {(current.teachingStyle ?? []).length > 0
                      ? current.teachingStyle.map((s) => (
                          <span key={s} className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${isDark ? "border-white/[0.08] text-neutral-400" : "border-neutral-200 text-neutral-500"}`}>{s}</span>
                        ))
                      : <span className={`text-[10px] ${isDark ? "text-neutral-600" : "text-neutral-400"}`}>—</span>
                    }
                  </div>
                )}
              </div>
            )}

            {/* Cert link */}
            <div className="space-y-1.5">
              <span className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>Certification</span>
              {editing ? (
                <input
                  value={draft.certificationUrl}
                  onChange={(e) => setDraft((d) => ({ ...d, certificationUrl: e.target.value }))}
                  className={inputCls}
                  placeholder="https://coursera.org/cert/..."
                />
              ) : current.certificationUrl ? (
                <a
                  href={current.certificationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] font-bold text-[#e2593b] hover:underline"
                >
                  <ExternalLink size={10} /> View cert
                </a>
              ) : (
                <span className={`text-[10px] ${isDark ? "text-neutral-600" : "text-neutral-400"}`}>—</span>
              )}
            </div>

            {/* Endorsements */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1.5">
                <ThumbsUp size={11} className={isDark ? "text-neutral-500" : "text-neutral-400"} />
                <span className={`text-[10px] font-bold ${isDark ? "text-neutral-400" : "text-neutral-600"}`}>
                  {(meta?.endorsements ?? 0) + (endorsed ? 1 : 0)} endorsement{(meta?.endorsements ?? 0) + (endorsed ? 1 : 0) !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-1.5">
                {!isOwnProfile && isMatched && !endorsed && (
                  <button
                    onClick={handleEndorse}
                    className={`px-2.5 py-1 rounded-lg text-[9px] font-bold border transition-all active:scale-95 ${
                      isDark ? "border-white/10 text-neutral-300 hover:bg-white/[0.06]" : "border-neutral-200 text-neutral-600 hover:bg-neutral-100"
                    }`}
                  >
                    +1
                  </button>
                )}
                {endorsed && (
                  <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-500">
                    <Check size={10} /> Endorsed
                  </span>
                )}
                {isOwnProfile && !editing && (
                  <button
                    onClick={() => setEditing(true)}
                    className={`px-2.5 py-1 rounded-lg text-[9px] font-bold border transition-all active:scale-95 ${
                      isDark ? "border-white/10 text-neutral-300 hover:bg-white/[0.06]" : "border-neutral-200 text-neutral-600 hover:bg-neutral-100"
                    }`}
                  >
                    Edit
                  </button>
                )}
                {isOwnProfile && editing && (
                  <>
                    <button onClick={() => setEditing(false)} className={`px-2.5 py-1 rounded-lg text-[9px] font-bold border transition-all ${isDark ? "border-white/10 text-neutral-400" : "border-neutral-200 text-neutral-500"}`}>
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      className={`px-2.5 py-1 rounded-lg text-[9px] font-bold transition-all active:scale-95 ${
                        isDark ? "bg-white text-black hover:bg-neutral-100" : "bg-[#e2593b] text-white hover:bg-[#d44a2e]"
                      }`}
                    >
                      Save
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
