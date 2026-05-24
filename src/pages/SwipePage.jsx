import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Zap, X, Heart, LogIn, Loader2, MessageCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
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
      <div className="min-h-screen flex items-center justify-center bg-base-100">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-100 px-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-2">Sign in to discover</h1>
          <p className="text-base-content/60 mb-6">
            Create an account to swipe and match with other learners.
          </p>
          <button
            onClick={() => navigate("/login")}
            className="btn btn-vibrant-primary gap-2"
          >
            <LogIn size={18} />
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100 text-base-content relative overflow-hidden px-4 py-10">
      <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-primary/20 blur-3xl rounded-full" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-secondary/20 blur-3xl rounded-full" />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold">
            Find Your <span className="text-gradient">Skill Match</span>
          </h1>
          <p className="text-base-content/60 mt-3">Swipe, connect, and grow together</p>
          <p className="text-sm text-base-content/40 mt-2">
            {usersLoading
              ? "Loading profiles..."
              : deckMeta
                ? `${users.length} to swipe · ${deckMeta.otherUsersCount} other member${deckMeta.otherUsersCount === 1 ? "" : "s"} on SkillSwap`
                : `${users.length} profiles available`}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-10 justify-center">
          <div className="w-full max-w-md flex flex-col items-center">
            <div className="relative w-full h-[620px]">
              <AnimatePresence>
                {usersLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="animate-spin text-primary" size={40} />
                  </div>
                ) : users.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-0 glass rounded-[32px] flex flex-col items-center justify-center text-center p-10"
                  >
                    <div className="text-6xl mb-4">
                      {loadError ? "⚠️" : deckMeta?.otherUsersCount === 0 ? "👋" : "🎉"}
                    </div>
                    <h2 className="text-2xl font-bold mb-2">
                      {loadError
                        ? "Could not load profiles"
                        : deckMeta?.otherUsersCount === 0
                          ? "No one else to swipe yet"
                          : "No more profiles in your deck"}
                    </h2>
                    <p className="text-base-content/60 mb-6 text-sm leading-relaxed max-w-xs">
                      {loadError ? (
                        loadError
                      ) : deckMeta?.otherUsersCount === 0 ? (
                        <>
                          Only your account exists in the database. Create a{" "}
                          <strong>second account</strong> (incognito / another browser), sign up,
                          then refresh here.
                        </>
                      ) : (
                        <>
                          You already liked or matched {deckMeta?.hiddenCount ?? 0} member
                          {deckMeta?.hiddenCount === 1 ? "" : "s"}. Skipped profiles will reappear
                          after refresh.
                        </>
                      )}
                    </p>
                    <button
                      onClick={loadSwipeDeck}
                      className="btn btn-vibrant-primary rounded-2xl font-semibold gap-2"
                    >
                      <RotateCcw size={16} />
                      Refresh
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
                          className="absolute w-full h-full"
                          style={{
                            transform: `scale(${1 - index * 0.04}) translateY(${index * 12}px)`,
                            zIndex: 10 - index,
                          }}
                        >
                          <SwipeCard
                            user={swipeUser}
                            index={index}
                            isTop={index === 0}
                            onSwipe={handleSwipe}
                          />
                        </div>
                      );
                    })
                )}
              </AnimatePresence>
            </div>

            <div className="flex items-center gap-4 mt-8">
              <button
                onClick={() => handleSwipe("skip")}
                disabled={!users.length || swiping}
                className="btn btn-vibrant-error gap-2 font-semibold disabled:opacity-40"
              >
                <X size={16} />
                Reject
              </button>

              <button
                onClick={handleUndo}
                disabled={!history.length || swiping}
                className="btn btn-icon-vibrant bg-slate-400 hover:bg-slate-500 text-white disabled:opacity-40"
              >
                <RotateCcw size={18} />
              </button>

              <button
                onClick={() => handleSwipe("like")}
                disabled={!users.length || swiping}
                className="btn btn-vibrant-success gap-2 font-semibold disabled:opacity-40"
              >
                <Heart size={16} />
                Accept
              </button>
            </div>
          </div>

          <div className="w-full max-w-sm">
            <div className="glass rounded-[32px] p-6">
              <div className="flex items-center gap-3 mb-6">
                <Zap className="text-primary" />
                <h3 className="font-bold text-lg">Matches</h3>
                <span className="ml-auto text-sm text-base-content/50">
                  {matches.length}
                </span>
              </div>

              {matches.length === 0 ? (
                <p className="text-base-content/40 text-sm">No matches yet</p>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-auto pr-2">
                  {matches.map((match) => {
                    const peer = matchProfiles[match.id];
                    if (!peer) return null;

                    return (
                      <div
                        key={match.id}
                        className="flex items-center gap-3 p-3 rounded-2xl bg-base-200/60 hover:bg-base-200 transition"
                      >
                        <UserAvatar user={peer} size="lg" className="rounded-2xl" />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold truncate">{peer.name}</p>
                          <p className="text-xs text-base-content/50 truncate">
                            {peer.location || "SkillSwap member"}
                          </p>
                        </div>
                        <Link
                          to={`/chat?matchId=${match.id}`}
                          className="btn btn-ghost btn-circle btn-sm text-primary"
                          title="Message"
                        >
                          <MessageCircle size={18} />
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl text-white ${
              toast.type === "match"
                ? "bg-primary"
                : toast.type === "like"
                  ? "bg-green-500"
                  : toast.type === "error"
                    ? "bg-orange-500"
                    : "bg-red-500"
            }`}
          >
            {toast.type === "match"
              ? `🎉 Match with ${toast.name}!`
              : toast.type === "like"
                ? `❤️ Liked ${toast.name}`
                : toast.type === "error"
                  ? toast.name
                  : `❌ Skipped ${toast.name}`}
            {toast.extra && (
              <span className="block text-xs opacity-90">{toast.extra}</span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
