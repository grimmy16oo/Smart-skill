import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Zap, LogIn, Loader2, MessageCircle, Sparkles, MapPin } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { getUsersForSwipe, getUserProfile } from "../services/userService";
import {
  getPeerUidFromMatch,
  recordSwipeLike,
  recordSwipeSkip,
  subscribeToMatches,
  undoSwipeLike,
  undoSwipeSkip,
} from "../services/matchService";
import SwipeCard from "../components/SwipeCard";
import UserAvatar from "../components/UserAvatar";

export default function SwipePage() {
  const { user, profile, loading: authLoading } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [deckMeta, setDeckMeta] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [usersLoading, setUsersLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [matches, setMatches] = useState([]);
  const [matchProfiles, setMatchProfiles] = useState({});
  const [toast, setToast] = useState(null);
  const [swiping, setSwiping] = useState(false);

  const showToast = (type, name, extra) => {
    setToast({ type, name, extra });
    setTimeout(() => setToast(null), 2200);
  };

  const loadSwipeDeck = useCallback(async () => {
    if (!user?.uid) return;

    setUsersLoading(true);
    setLoadError(null);

    try {
      const result = await getUsersForSwipe(user.uid, profile ?? null);
      setUsers(result.users);
      setDeckMeta(result);
    } catch (error) {
      console.error("Failed to load users:", error);
      setUsers([]);
      setDeckMeta(null);
      setLoadError(error.message || "Could not load profiles");
      showToast("error", "Could not load profiles");
    } finally {
      setUsersLoading(false);
    }
  }, [user?.uid, profile]);

  useEffect(() => {
    if (!authLoading && user?.uid) {
      loadSwipeDeck();
    }
  }, [user?.uid, authLoading, loadSwipeDeck]);

  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = subscribeToMatches(user.uid, async (nextMatches) => {
      setMatches(nextMatches);

      const profiles = {};
      await Promise.all(
        nextMatches.map(async (match) => {
          const peerUid = getPeerUidFromMatch(match.users, user.uid);
          if (!peerUid) return;
          const peer = await getUserProfile(peerUid);
          if (peer) profiles[match.id] = { ...peer, matchId: match.id };
        })
      );
      setMatchProfiles(profiles);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const handleSwipe = async (dir) => {
    if (!users.length || swiping || !user?.uid) return;

    const current = users[0];
    setSwiping(true);

    setHistory((p) => [{ user: current, action: dir }, ...p]);
    setUsers((p) => p.slice(1));

    try {
      if (dir === "like") {
        const newMatch = await recordSwipeLike(user.uid, current.uid);
        if (newMatch) {
          showToast("match", current.name, "It's a match!");
        } else {
          showToast("like", current.name);
        }
      } else {
        await recordSwipeSkip(current.uid);
        showToast("skip", current.name);
      }
    } catch (error) {
      console.error("Swipe error:", error);
      showToast("error", "Swipe failed");
      setUsers((p) => [current, ...p]);
      setHistory((p) => p.slice(1));
    } finally {
      setSwiping(false);
    }
  };

  const handleUndo = async () => {
    if (!history.length || !user?.uid) return;

    const last = history[0];
    setHistory((p) => p.slice(1));
    setUsers((p) => [last.user, ...p]);

    if (last.action === "like") {
      try {
        await undoSwipeLike(last.user.uid);
      } catch (error) {
        console.error("Undo like error:", error);
      }
    } else {
      try {
        await undoSwipeSkip(last.user.uid);
      } catch (error) {
        console.error("Undo skip error:", error);
      }
    }
  };

  if (authLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${isDark ? "bg-[#0b0b0b]" : "bg-[#fcfcfc]"}`}>
        <Loader2 className="animate-spin text-[#e2593b]" size={36} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`min-h-screen flex items-center justify-center px-6 transition-colors duration-300 ${isDark ? "bg-[#0b0b0b] text-white" : "bg-[#fcfcfc] text-neutral-900"}`}>
        <div className={`text-center max-w-sm p-8 rounded-[32px] border ${isDark ? "border-white/[0.06] bg-white/[0.01]" : "border-neutral-900/[0.06] bg-neutral-900/[0.01] shadow-xl"}`}>
          <div className="w-12 h-12 rounded-2xl bg-[#e2593b]/10 flex items-center justify-center mx-auto mb-5 text-[#e2593b]">
            <Sparkles size={22} />
          </div>
          <h1 className="text-2xl font-black tracking-tight mb-2">Sign in to discover</h1>
          <p className={`text-xs font-medium leading-relaxed mb-6 ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
            Create an account to meet people who want to trade knowledge, not money.
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
    <div className={`min-h-screen relative overflow-y-auto overflow-x-hidden pb-16 px-6 lg:px-16 transition-colors duration-300 pt-10 ${
      isDark ? "bg-[#0b0b0b] text-white" : "bg-[#fcfcfc] text-neutral-900"
    }`}>
      <div className="max-w-6xl mx-auto relative z-10">
        
        {/* HEADER BRAND CONTROL MATRIX */}
        <div className="text-center mb-14">
          <span className="text-xs font-bold text-[#e2593b] uppercase tracking-widest block mb-2">
            Discover people
          </span>
          <h1 className="text-4xl lg:text-5xl font-black tracking-tighter leading-none">
            Find Your <span className="text-[#e2593b]">Skill Match.</span>
          </h1>
          <p className={`text-sm font-medium mt-3 ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
            Like people you can learn from, teach, or collaborate with.
          </p>
          <div className="inline-flex items-center gap-2 mt-4 px-3 py-1 rounded-full border text-[11px] font-mono font-medium tracking-tight bg-neutral-500/5 border-neutral-500/10">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className={isDark ? "text-neutral-400" : "text-neutral-500"}>
              {usersLoading
                ? "Loading skill profiles..."
                : deckMeta
                  ? `${users.length} available | ${deckMeta.otherUsersCount} member${deckMeta.otherUsersCount === 1 ? "" : "s"} total`
                  : `${users.length} profiles ready`}
            </span>
          </div>
        </div>

        {/* CONTAINER LAYOUT GRID */}
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-start max-w-5xl mx-auto">
          
          {/* LEFT INTERACTION DECK PORTAL */}
          <div className="lg:col-span-6 flex flex-col items-center">
            <div className="relative w-full max-w-[380px] h-[540px]">
              <AnimatePresence mode="wait">
                {usersLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="animate-spin text-[#e2593b]" size={32} />
                  </div>
                ) : users.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className={`absolute inset-0 rounded-[32px] border p-8 flex flex-col items-center justify-center text-center ${
                      isDark ? "border-white/[0.06] bg-white/[0.01]" : "border-neutral-900/[0.06] bg-neutral-900/[0.01]"
                    }`}
                  >
                    <div className="text-4xl mb-4 font-black text-[#e2593b]">
                      {loadError ? "!" : deckMeta?.otherUsersCount === 0 ? "0" : "*"}
                    </div>
                    <h2 className="text-lg font-bold tracking-tight mb-2">
                      {loadError
                        ? "Could not load profiles"
                        : deckMeta?.otherUsersCount === 0
                          ? "No other members yet"
                          : "You reached the end"}
                    </h2>
                    <p className={`text-xs font-medium leading-relaxed mb-6 max-w-[260px] ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
                      {loadError ? (
                        loadError
                      ) : deckMeta?.otherUsersCount === 0 ? (
                        <>
                          Create another account in a private window to test matching, or invite a friend to join.
                        </>
                      ) : (
                        <>
                          You have seen everyone currently available. Reload later to check for new skill partners.
                        </>
                      )}
                    </p>
                    <button
                      onClick={loadSwipeDeck}
                      className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-transform active:scale-[0.97] ${
                        isDark ? "bg-white text-black hover:bg-neutral-100" : "bg-neutral-950 text-white hover:bg-neutral-800"
                      }`}
                    >
                      <RotateCcw size={12} />
                      Reload profiles
                    </button>
                  </motion.div>
                ) : (
                  [...users]
                    .slice(0, 3)
                    .reverse()
                    .map((swipeUser, i, arr) => {
                      const index = arr.length - 1 - i;
                      return (
                        <div
                          key={swipeUser.uid}
                          className="absolute w-full h-full transition-all duration-300 ease-out"
                          style={{
                            transform: `scale(${1 - index * 0.035}) translateY(${index * 10}px)`,
                            zIndex: 10 - index,
                            opacity: index === 0 ? 1 : 0.4 / index,
                            pointerEvents: index === 0 ? "auto" : "none"
                          }}
                        >
                          <SwipeCard
                            user={swipeUser}
                            index={index}
                            isTop={index === 0}
                            onSwipe={handleSwipe}
                            isDark={isDark}
                          />
                        </div>
                      );
                    })
                )}
              </AnimatePresence>
            </div>

            {/* ACTION TRIGGERS MATRIX PANEL */}
            <div className="flex items-center gap-4 mt-8 w-full max-w-[380px] justify-center">
              <button
                onClick={() => handleSwipe("skip")}
                disabled={!users.length || swiping}
                className={`w-20 h-12 rounded-full flex items-center justify-center border transition-all duration-200 cursor-pointer disabled:opacity-20 active:scale-95 ${
                  isDark 
                    ? "border-white/[0.08] bg-white/[0.02] text-red-400 hover:bg-red-500/10 hover:border-red-500/30" 
                    : "border-neutral-900/[0.08] bg-neutral-900/[0.02] text-red-500 hover:bg-red-500/5 hover:border-red-500/20 shadow-sm"
                }`}
                title="Pass"
              >
                Reject
              </button>

              <button
                onClick={handleUndo}
                disabled={!history.length || swiping}
                className={`w-11 h-11 rounded-full flex items-center justify-center border transition-all duration-200 cursor-pointer disabled:opacity-20 active:scale-95 ${
                  isDark 
                    ? "border-white/[0.08] bg-white/[0.02] text-neutral-400 hover:text-white" 
                    : "border-neutral-900/[0.08] bg-neutral-900/[0.02] text-neutral-500 hover:text-neutral-900 shadow-sm"
                }`}
                title="Undo Action"
              >
                <RotateCcw size={15} />
              </button>

              <button
                onClick={() => handleSwipe("like")}
                disabled={!users.length || swiping}
                className={`w-20 h-12 rounded-full flex items-center justify-center border transition-all duration-200 cursor-pointer disabled:opacity-20 active:scale-95 ${
                  isDark 
                    ? "border-white/[0.08] bg-white/[0.02] text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30" 
                    : "border-neutral-900/[0.08] bg-neutral-900/[0.02] text-emerald-600 hover:bg-emerald-500/5 hover:border-emerald-500/20 shadow-sm"
                }`}
                title="Like"
              >
                Accept
              </button>
            </div>
          </div>

          {/* RIGHT SIDEBAR - REALTIME MATCH MATRIX FEED */}
          <div className="lg:col-span-6">
            <div className={`rounded-[32px] border p-6 lg:p-8 transition-colors ${
              isDark 
                ? "border-white/[0.06] bg-white/[0.01]" 
                : "border-neutral-900/[0.06] bg-neutral-900/[0.01] shadow-xl shadow-neutral-200/40"
            }`}>
              <div className="flex items-center gap-3 mb-6 border-b border-neutral-500/5 pb-4">
                <div className="w-7 h-7 rounded-lg bg-[#e2593b]/10 flex items-center justify-center text-[#e2593b]">
                  <Zap size={14} className="fill-current" />
                </div>
                <h3 className="font-bold text-sm uppercase tracking-wider">Your matches</h3>
                <span className={`ml-auto text-xs font-mono font-bold px-2 py-0.5 rounded-md ${
                  isDark ? "bg-white/5 text-neutral-300" : "bg-neutral-950/5 text-neutral-600"
                }`}>
                  {matches.length}
                </span>
              </div>

              {matches.length === 0 ? (
                <div className="text-center py-16">
                  <p className={`text-xs font-medium ${isDark ? "text-white/30" : "text-neutral-400"}`}>
                    No matches yet. Like someone who likes you back to start chatting.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[420px] overflow-auto pr-1">
                  {matches.map((match) => {
                    const peer = matchProfiles[match.id] || {
                      uid: getPeerUidFromMatch(match.users, user.uid),
                      name: "Loading...",
                      location: "SkillSwap member",
                    };

                    return (
                      <div
                        key={match.id}
                        className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                          isDark 
                            ? "border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/[0.08]" 
                            : "border-neutral-900/[0.04] bg-[#fdfdfd] hover:bg-neutral-50 hover:border-neutral-900/[0.08]"
                        }`}
                      >
                        <Link
                          to={`/profile/${peer.uid}`}
                          className="flex items-center gap-4 flex-1 min-w-0 hover:opacity-80 transition-opacity"
                        >
                          <UserAvatar user={peer} size="lg" className="rounded-xl border border-neutral-500/10 flex-shrink-0" />
                          
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-sm tracking-tight truncate">{peer.name}</p>
                            <p className={`text-xs font-medium flex items-center gap-1.5 mt-0.5 truncate ${
                              isDark ? "text-neutral-400" : "text-neutral-500"
                            }`}>
                              <MapPin size={10} className="text-[#e2593b]" />
                              {peer.location || "SkillSwap member"}
                            </p>
                          </div>
                        </Link>

                        <button
                          type="button"
                          onClick={() => navigate(`/chat?matchId=${match.id}`)}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                            isDark 
                              ? "bg-white/[0.04] text-white hover:bg-white hover:text-black" 
                              : "bg-neutral-950/[0.04] text-neutral-900 hover:bg-neutral-950 hover:text-white"
                          }`}
                          title="Open chat"
                        >
                          <MessageCircle size={15} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* SYSTEM EVENT ALERTS TOAST HUB */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl shadow-xl text-xs font-bold tracking-wide uppercase flex flex-col items-center justify-center z-50 text-white min-w-[220px] ${
              toast.type === "match"
                ? "bg-[#e2593b]"
                : toast.type === "like"
                  ? "bg-emerald-600"
                  : toast.type === "error"
                    ? "bg-orange-500"
                    : "bg-neutral-800"
            }`}
          >
            <div className="flex items-center gap-2">
              <span>
                {toast.type === "match"
                  ? `New match: ${toast.name}!`
                  : toast.type === "like"
                    ? `Liked ${toast.name}`
                    : toast.type === "error"
                      ? toast.name
                      : `Skipped ${toast.name}`}
              </span>
            </div>
            {toast.extra && (
              <span className="block text-[10px] font-medium opacity-80 mt-0.5 lowercase font-mono">
                {toast.extra}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
