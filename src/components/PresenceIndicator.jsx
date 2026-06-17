/**
 * PresenceIndicator.jsx
 * Shows real-time online status for a user.
 * On own profile: lets user pick their status.
 * On other profiles: subscribe and display.
 *
 * Props:
 *  - uid          {string}
 *  - isOwnProfile {boolean}
 *  - isDark       {boolean}
 */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Circle, Wifi, Clock, Search } from "lucide-react";
import { startPresence, subscribeToPresence, updatePresenceStatus } from "../services/profileFeatureService";

const STATUS_OPTIONS = [
  { value: "online",          label: "Online",              color: "bg-emerald-500",  icon: Wifi },
  { value: "in_session",      label: "In a session",        color: "bg-amber-500",    icon: Circle },
  { value: "away",            label: "Away",                color: "bg-neutral-500",  icon: Clock },
  { value: "looking_to_learn",label: "Looking to learn",    color: "bg-blue-500",     icon: Search },
];

function formatLastSeen(ts) {
  if (!ts) return "a while ago";
  const date = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function PresenceIndicator({ uid, isOwnProfile, isDark }) {
  const [presence, setPresence] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [statusDetail, setStatusDetail] = useState("");

  // Own profile: start heartbeat
  useEffect(() => {
    if (!isOwnProfile || !uid) return;
    const cleanup = startPresence(uid, "online");
    return cleanup;
  }, [uid, isOwnProfile]);

  // Subscribe to presence
  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeToPresence(uid, setPresence);
    return unsub;
  }, [uid]);

  const status = presence?.status ?? "away";
  const option = STATUS_OPTIONS.find((o) => o.value === status) ?? STATUS_OPTIONS[2];

  async function handleStatusChange(val) {
    await updatePresenceStatus(uid, val, statusDetail);
    setShowPicker(false);
  }

  const isOnline = status === "online" || status === "in_session";

  return (
    <div className="relative">
      <button
        onClick={() => isOwnProfile && setShowPicker((p) => !p)}
        disabled={!isOwnProfile}
        className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all ${
          isOwnProfile ? "cursor-pointer" : "cursor-default"
        } ${isDark ? "text-neutral-400 hover:text-neutral-200" : "text-neutral-500 hover:text-neutral-700"}`}
        title={isOwnProfile ? "Change status" : undefined}
      >
        {/* Pulsing dot */}
        <span className="relative flex h-2 w-2">
          {isOnline && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${option.color}`} />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${option.color}`} />
        </span>

        {status === "online" && "Online"}
        {status === "in_session" && "In a session"}
        {status === "away" && (presence?.lastSeen ? `Last seen ${formatLastSeen(presence.lastSeen)}` : "Away")}
        {status === "looking_to_learn" && `Looking to learn${presence?.statusDetail ? ` ${presence.statusDetail}` : ""}`}
      </button>

      {/* Status picker */}
      <AnimatePresence>
        {showPicker && isOwnProfile && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -4 }}
            transition={{ duration: 0.15 }}
            className={`absolute z-50 top-full mt-2 left-0 min-w-[200px] rounded-2xl border shadow-xl p-3 space-y-1 ${
              isDark ? "bg-[#111] border-white/[0.08]" : "bg-white border-neutral-200"
            }`}
          >
            <p className={`text-[9px] font-bold uppercase tracking-widest mb-2 ${isDark ? "text-neutral-600" : "text-neutral-400"}`}>Set status</p>
            {STATUS_OPTIONS.map((opt) => {
              return (
                <button
                  key={opt.value}
                  onClick={() => handleStatusChange(opt.value)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[10px] font-bold transition-all text-left ${
                    status === opt.value
                      ? isDark ? "bg-white/[0.08] text-white" : "bg-neutral-100 text-neutral-900"
                      : isDark ? "text-neutral-400 hover:bg-white/[0.04] hover:text-white" : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${opt.color}`} />
                  {opt.label}
                </button>
              );
            })}

            {/* Detail for "looking to learn" */}
            {status === "looking_to_learn" && (
              <div className="pt-2">
                <input
                  value={statusDetail}
                  onChange={(e) => setStatusDetail(e.target.value)}
                  placeholder="Which skill? (e.g. Rust)"
                  className={`w-full px-3 py-1.5 text-[10px] font-medium rounded-lg border outline-none ${
                    isDark
                      ? "bg-neutral-900 text-white border-white/10 focus:border-[#e2593b]"
                      : "bg-white text-neutral-900 border-neutral-300 focus:border-[#e2593b]"
                  }`}
                  onKeyDown={(e) => e.key === "Enter" && handleStatusChange("looking_to_learn")}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
