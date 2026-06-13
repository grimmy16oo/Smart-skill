import { motion, useMotionValue, useTransform } from "framer-motion";
import { MapPin, Star } from "lucide-react";
import { Link } from "react-router-dom";
import SkillBadge from "./SkillBadge";
import UserAvatar from "./UserAvatar";
import { hasRealAvatar } from "../utils/avatar";

export default function SwipeCard({ user, onSwipe, isTop, index, isDark }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-20, 20]);

  const handleDragEnd = (_, info) => {
    if (!isTop) return;

    if (info.offset.x > 120) onSwipe("like");
    else if (info.offset.x < -120) onSwipe("skip");
  };

  const rating = user.rating ?? 0;
  const reviewCount = user.reviewCount ?? 0;
  const matchPercent = user.matchPercent ?? 0;

  return (
    <motion.div
      drag={isTop ? "x" : false}
      onDragEnd={handleDragEnd}
      style={{ x, rotate }}
      className="absolute w-full h-full cursor-grab active:cursor-grabbing will-change-transform"
      initial={{
        scale: 1 - index * 0.05,
        y: index * 12,
        opacity: 0,
      }}
      animate={{
        scale: 1 - index * 0.05,
        y: index * 12,
        opacity: 1,
      }}
      exit={{
        opacity: 0,
        scale: 0.8,
        x: x.get() > 0 ? 300 : -300,
        rotate: x.get() > 0 ? 20 : -20,
        transition: { duration: 0.25 },
      }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      <div className="h-full w-full overflow-hidden rounded-3xl border border-base-300 bg-base-100 shadow-xl transition-colors duration-200">

        {/* IMAGE SECTION */}
        <div className="relative h-[58%] bg-gradient-to-br from-slate-950 via-indigo-700 to-cyan-500">
          {hasRealAvatar(user.avatar) ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <UserAvatar user={user} size="2xl" className="ring-4 ring-white/40" />
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/75 to-transparent pointer-events-none" />

          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3 text-white z-10">
            <div className="min-w-0 flex-1">
              <Link
                to={`/profile/${user.uid}`}
                onClick={(e) => e.stopPropagation()}
                className="hover:underline inline-block max-w-full"
              >
                <h2 className="truncate text-3xl font-bold leading-tight">
                  {user.name}
                </h2>
              </Link>

              <p className="mt-1 flex items-center gap-1 text-sm text-white/90">
                <MapPin size={14} />
                {user.location || "SkillSwap member"}
              </p>
            </div>

            {/* MATCH SCORE */}
            <div className="rounded-2xl bg-white/95 px-3 py-2 text-center text-slate-900 shadow">
              <div className="text-lg font-black leading-none">
                {matchPercent}%
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Match
              </div>
            </div>
          </div>
        </div>

        {/* INFO SECTION */}
        <div className="flex h-[42%] flex-col gap-4 p-5">

          {/* RATING SECTION (FIXED CONTRAST) */}
          <div className={`flex items-center gap-2 text-sm ${
            isDark ? "text-black" : "text-base-content/60"
          }`}>
            <Star size={15} className="fill-amber-400 text-amber-400" />
            <span>
              {rating > 0
                ? `${rating.toFixed(1)} rating`
                : "No ratings yet"}
              {reviewCount > 0 && (
                <span className="ml-1 text-xs opacity-70">
                  ({reviewCount})
                </span>
              )}
            </span>
          </div>

          {/* BIO TEXT (FIXED CONTRAST) */}
          <p className={`line-clamp-3 text-sm leading-6 ${
            isDark ? "text-black" : "text-base-content/75"
          }`}>
            {user.bio || "No bio yet"}
          </p>

          {/* SKILLS */}
          <div className="mt-auto space-y-3">
            <div className="flex flex-wrap gap-2">
              {(user.skillsOffered || []).slice(0, 3).map((skill) => (
                <SkillBadge key={skill} skill={skill} variant="offered" />
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {(user.skillsWanted || []).slice(0, 3).map((skill) => (
                <SkillBadge key={skill} skill={skill} variant="wanted" />
              ))}
            </div>
          </div>

        </div>
      </div>
    </motion.div>
  );
}