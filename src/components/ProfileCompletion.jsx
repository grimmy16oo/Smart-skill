/**
 * ProfileCompletion.jsx
 * Profile completeness checklist with progress bar + smart skill suggestions.
 * Only shown on own profile.
 *
 * Props:
 *  - profile      {object}   merged displayProfile
 *  - isDark       {boolean}
 *  - activityCount {number}  number of completed sessions (for first exchange badge)
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Check, ChevronRight } from "lucide-react";

// ── Skill suggestion map ───────────────────────────────────────────────────────
const SKILL_SUGGESTIONS = {
  React: ["JavaScript", "TypeScript", "Next.js", "Tailwind CSS", "Redux"],
  JavaScript: ["TypeScript", "React", "Node.js", "Jest", "ESLint"],
  Python: ["Django", "FastAPI", "Pandas", "NumPy", "pytest"],
  Node: ["Express", "Prisma", "Jest", "GraphQL", "tRPC"],
  "Node.js": ["Express", "Prisma", "Jest", "GraphQL", "tRPC"],
  TypeScript: ["React", "Next.js", "Zod", "Prisma"],
  Figma: ["UI Design", "Prototyping", "Design Systems", "Framer"],
  "UI Design": ["Figma", "CSS", "Tailwind CSS", "Accessibility"],
  Docker: ["Kubernetes", "CI/CD", "Linux", "Terraform"],
  SQL: ["PostgreSQL", "Prisma", "Data Modeling", "Supabase"],
  Firebase: ["Firestore", "Auth", "Cloud Functions", "React"],
};

function getSuggestions(skills = []) {
  const suggestions = new Set();
  const existing = new Set(skills.map((s) => s.toLowerCase()));
  skills.forEach((skill) => {
    const related = SKILL_SUGGESTIONS[skill] ?? [];
    related.forEach((s) => {
      if (!existing.has(s.toLowerCase())) suggestions.add(s);
    });
  });
  return [...suggestions].slice(0, 6);
}

// ── Motivational messages ─────────────────────────────────────────────────────
const MESSAGES = [
  { minPct: 0,  max: 40,  text: "Your profile is just getting started. A strong profile gets 3× more connections!" },
  { minPct: 40, max: 70,  text: "Good progress! Adding a bio gets you 2× more match requests." },
  { minPct: 70, max: 90,  text: "Almost there — just a few more items for a standout profile." },
  { minPct: 90, max: 101, text: "You're a top-tier profile! People with complete profiles get priority in discovery." },
];

function getMotivation(pct) {
  return MESSAGES.find((m) => pct >= m.minPct && pct < m.max)?.text ?? "";
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ProfileCompletion({ profile, isDark, activityCount = 0 }) {
  const checks = useMemo(() => [
    {
      id: "photo",
      label: "Add a profile photo",
      done: !!(profile?.avatar && profile.avatar.startsWith("http")),
      required: true,
    },
    {
      id: "bio",
      label: "Write a bio (50+ characters)",
      done: (profile?.bio?.length ?? 0) >= 50,
    },
    {
      id: "location",
      label: "Set your location",
      done: !!(profile?.location?.trim()),
    },
    {
      id: "offered",
      label: "Add at least 3 skills you can teach",
      done: (profile?.skillsOffered?.length ?? 0) >= 3,
    },
    {
      id: "wanted",
      label: "Add at least 2 skills you want to learn",
      done: (profile?.skillsWanted?.length ?? 0) >= 2,
    },
    {
      id: "exchange",
      label: "Complete your first skill exchange",
      done: activityCount >= 1,
    },
  ], [profile, activityCount]);

  const done = checks.filter((c) => c.done).length;
  const pct = Math.round((done / checks.length) * 100);

  const suggestions = useMemo(
    () => getSuggestions([...(profile?.skillsOffered ?? []), ...(profile?.skillsWanted ?? [])]),
    [profile]
  );

  const motivation = getMotivation(pct);

  return (
    <div className="space-y-5">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
            Profile completeness
          </span>
          <span className={`text-[10px] font-black ${pct === 100 ? "text-emerald-500" : isDark ? "text-neutral-300" : "text-neutral-700"}`}>
            {pct}%
          </span>
        </div>

        <div className={`h-2 rounded-full overflow-hidden ${isDark ? "bg-white/[0.06]" : "bg-neutral-100"}`}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="h-full rounded-full bg-gradient-to-r from-[#e2593b] to-indigo-500"
          />
        </div>

        {motivation && (
          <p className={`text-[10px] font-medium leading-relaxed ${isDark ? "text-neutral-500" : "text-neutral-500"}`}>
            {motivation}
          </p>
        )}
      </div>

      {/* Checklist */}
      <ul className="space-y-2">
        {checks.map((item, i) => (
          <motion.li
            key={item.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
              item.done
                ? isDark ? "border-emerald-500/20 bg-emerald-500/5" : "border-emerald-200 bg-emerald-50"
                : isDark ? "border-white/[0.06] bg-white/[0.01]" : "border-neutral-200 bg-neutral-50"
            }`}
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
              item.done
                ? "bg-emerald-500"
                : isDark ? "bg-white/[0.06] border border-white/10" : "bg-neutral-200 border border-neutral-300"
            }`}>
              {item.done
                ? <Check size={10} className="text-white" strokeWidth={3} />
                : item.required
                ? <span className="text-[8px] font-black text-rose-500">!</span>
                : null
              }
            </div>
            <span className={`text-[11px] font-medium flex-1 ${
              item.done
                ? isDark ? "text-neutral-400 line-through" : "text-neutral-400 line-through"
                : isDark ? "text-neutral-200" : "text-neutral-700"
            }`}>
              {item.label}
            </span>
            {!item.done && (
              <ChevronRight size={12} className={isDark ? "text-neutral-600" : "text-neutral-400"} />
            )}
          </motion.li>
        ))}
      </ul>

      {/* Skill suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
            Suggested skills to add
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <span
                key={s}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors cursor-default ${
                  isDark
                    ? "border-white/[0.08] bg-white/[0.02] text-neutral-300 hover:border-[#e2593b]/40 hover:text-[#e2593b]"
                    : "border-neutral-200 bg-neutral-50 text-neutral-600 hover:border-[#e2593b]/40 hover:text-[#e2593b]"
                }`}
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
