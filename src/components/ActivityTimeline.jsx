/**
 * ActivityTimeline.jsx
 * Shows recent skill exchanges + a GitHub-style contribution heatmap.
 *
 * Props:
 *  - uid         {string}   User whose activity to display
 *  - isOwnProfile {boolean}
 *  - isDark      {boolean}
 */

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Loader2, Award, BookOpen, TrendingUp, Zap } from "lucide-react";
import { getUserActivities } from "../services/profileFeatureService";

// ── helpers ──────────────────────────────────────────────────────────────────

function formatRelative(timestamp) {
  if (!timestamp) return "";
  const date =
    typeof timestamp.toDate === "function" ? timestamp.toDate() : new Date(timestamp);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function isoDate(ts) {
  if (!ts) return null;
  const d = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
  return d.toISOString().slice(0, 10);
}

// ── Achievement definitions ───────────────────────────────────────────────────

const ACHIEVEMENTS = [
  { id: "first", label: "First Exchange", icon: Zap, threshold: 1, tone: "text-amber-500", bg: "bg-amber-500/10" },
  { id: "five", label: "5 Exchanges", icon: TrendingUp, threshold: 5, tone: "text-blue-500", bg: "bg-blue-500/10" },
  { id: "ten", label: "10 Exchanges", icon: Award, threshold: 10, tone: "text-purple-500", bg: "bg-purple-500/10" },
  { id: "taught5", label: "Mentor", icon: BookOpen, threshold: 5, tone: "text-emerald-500", bg: "bg-emerald-500/10", type: "taught" },
];

function computeAchievements(activities) {
  const total = activities.length;
  const taught = activities.filter((a) => a.type === "taught").length;
  return ACHIEVEMENTS.filter((ach) => {
    if (ach.type === "taught") return taught >= ach.threshold;
    return total >= ach.threshold;
  });
}

// ── Heatmap ───────────────────────────────────────────────────────────────────

function Heatmap({ activities, isDark }) {
  const weeks = useMemo(() => {
    // Build a map of date → count for the last 52 weeks
    const counts = {};
    activities.forEach((a) => {
      const d = isoDate(a.completedAt);
      if (d) counts[d] = (counts[d] ?? 0) + 1;
    });

    const today = new Date();
    // Align to last Sunday
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    const weekData = [];
    for (let w = 51; w >= 0; w--) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() - w * 7 + d);
        const key = date.toISOString().slice(0, 10);
        week.push({ date: key, count: counts[key] ?? 0 });
      }
      weekData.push(week);
    }
    return weekData;
  }, [activities]);

  function cellColor(count) {
    if (count === 0) return isDark ? "bg-white/[0.04]" : "bg-neutral-100";
    if (count === 1) return isDark ? "bg-[#e2593b]/30" : "bg-[#e2593b]/20";
    if (count === 2) return isDark ? "bg-[#e2593b]/55" : "bg-[#e2593b]/40";
    return isDark ? "bg-[#e2593b]" : "bg-[#e2593b]";
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-[3px] min-w-max">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((day) => (
              <div
                key={day.date}
                title={`${day.date}: ${day.count} session${day.count !== 1 ? "s" : ""}`}
                className={`w-[10px] h-[10px] rounded-[2px] transition-colors ${cellColor(day.count)}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className={`mt-2 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest ${isDark ? "text-neutral-600" : "text-neutral-400"}`}>
        <span>Less</span>
        {[0, 1, 2, 3].map((level) => (
          <div key={level} className={`w-[10px] h-[10px] rounded-[2px] ${cellColor(level)}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ActivityTimeline({ uid, isOwnProfile, isDark }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    setError(null);
    getUserActivities(uid)
      .then(setActivities)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [uid]);

  const achievements = useMemo(() => computeAchievements(activities), [activities]);
  const recent = activities.slice(0, 8);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="animate-spin text-[#e2593b]" size={18} />
      </div>
    );
  }

  if (error) {
    return (
      <p className={`text-xs font-medium py-4 ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
        Could not load activity: {error}
      </p>
    );
  }

  return (
    <div className="space-y-6">

      {/* Heatmap */}
      <div>
        <p className={`mb-3 text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
          Activity this year
        </p>
        {activities.length === 0 ? (
          <p className={`text-xs font-medium ${isDark ? "text-white/20" : "text-neutral-400"}`}>
            No sessions logged yet.
          </p>
        ) : (
          <Heatmap activities={activities} isDark={isDark} />
        )}
      </div>

      {/* Achievements */}
      {achievements.length > 0 && (
        <div>
          <p className={`mb-3 text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
            Achievements
          </p>
          <div className="flex flex-wrap gap-2">
            {achievements.map((ach) => {
              const Icon = ach.icon;
              return (
                <motion.div
                  key={ach.id}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-widest ${ach.bg} ${ach.tone} ${
                    isDark ? "border-white/[0.06]" : "border-neutral-200"
                  }`}
                >
                  <Icon size={11} />
                  {ach.label}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div>
        <p className={`mb-3 text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
          Recent sessions
        </p>
        {recent.length === 0 ? (
          <div className={`py-10 text-center rounded-2xl border border-dashed ${
            isDark ? "border-white/[0.06] text-white/20" : "border-neutral-200 text-neutral-400"
          }`}>
            <p className="text-xs font-medium">
              {isOwnProfile ? "Your completed skill exchanges will appear here." : "No public activity yet."}
            </p>
          </div>
        ) : (
          <div className="relative space-y-1">
            {/* vertical line */}
            <div className={`absolute left-[15px] top-2 bottom-2 w-px ${isDark ? "bg-white/[0.06]" : "bg-neutral-200"}`} />
            {recent.map((act, i) => (
              <motion.div
                key={act.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-start gap-3 pl-1"
              >
                {/* dot */}
                <div className={`relative z-10 mt-1 w-[7px] h-[7px] rounded-full shrink-0 ml-[9px] ${
                  act.type === "taught" ? "bg-[#e2593b]" : "bg-indigo-500"
                }`} />

                <div className="flex-1 min-w-0 py-1.5">
                  <p className={`text-xs font-medium leading-snug ${isDark ? "text-neutral-200" : "text-neutral-700"}`}>
                    {act.type === "taught" ? (
                      <>Taught <span className="font-bold text-[#e2593b]">{act.skill}</span> to{" "}
                        <button
                          onClick={() => navigate(`/profile/${act.partnerId}`)}
                          className={`font-bold underline-offset-2 hover:underline ${isDark ? "text-white" : "text-neutral-900"}`}
                        >
                          @{act.partnerName}
                        </button>
                      </>
                    ) : (
                      <>Learned <span className="font-bold text-indigo-400">{act.skill}</span> from{" "}
                        <button
                          onClick={() => navigate(`/profile/${act.partnerId}`)}
                          className={`font-bold underline-offset-2 hover:underline ${isDark ? "text-white" : "text-neutral-900"}`}
                        >
                          @{act.partnerName}
                        </button>
                      </>
                    )}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] font-medium ${isDark ? "text-neutral-600" : "text-neutral-400"}`}>
                      {formatRelative(act.completedAt)}
                    </span>
                    {act.sessionDuration > 0 && (
                      <span className={`text-[10px] font-medium ${isDark ? "text-neutral-600" : "text-neutral-400"}`}>
                        · {act.sessionDuration} min
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
