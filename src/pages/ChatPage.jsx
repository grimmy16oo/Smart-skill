// ChatPage - redesigned to match ProfilePage design language
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import {
  Send,
  Reply,
  Search,
  ArrowLeft,
  LogIn,
  Loader2,
  MessageSquare,
  Info,
  ChevronRight,
  Smile,
  Paperclip,
  X,
  Check,
  Star,
  Sparkles,
  FileText,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

import {
  ensureChatForMatch,
  fetchMatchMessages,
  formatMessageTime,
  formatRelativeTime,
  getDefaultUserProfile,
  getUserProfile,
  mergeMessages,
  normalizeSocketMessage,
  sendMessage,
} from "../services/chatService";

import {
  getPeerUidFromMatch,
  subscribeToMatches,
} from "../services/matchService";

import {
  connectSocket,
  disconnectSocket,
  joinMatchRoom,
  leaveMatchRoom,
  onChatError,
  onNewMessage,
} from "../services/socketService";

import UserAvatar from "../components/UserAvatar";

const LOADING_TIMEOUT_MS = 8000;

function sortMatchesByActivity(matches) {
  return [...matches].sort((a, b) => {
    const aTime = new Date(a.lastMessage?.timestamp || a.updatedAt || a.createdAt || 0).getTime();
    const bTime = new Date(b.lastMessage?.timestamp || b.updatedAt || b.createdAt || 0).getTime();
    return bTime - aTime;
  });
}

// ── Skeleton loader ────────────────────────────────────────────────────────────
function MatchSkeleton({ isDark }) {
  return (
    <>
      {[...Array(5)].map((_, i) => (
        <div key={i} className={`flex items-center gap-3 px-3 py-3 mx-1 rounded-2xl animate-pulse ${isDark ? "bg-white/[0.02]" : "bg-neutral-50"}`}>
          <div className={`w-10 h-10 rounded-xl shrink-0 ${isDark ? "bg-white/[0.06]" : "bg-neutral-200"}`} />
          <div className="flex-1 space-y-2">
            <div className={`h-2.5 rounded-full w-3/5 ${isDark ? "bg-white/[0.06]" : "bg-neutral-200"}`} />
            <div className={`h-2 rounded-full w-2/5 ${isDark ? "bg-white/[0.04]" : "bg-neutral-100"}`} />
          </div>
        </div>
      ))}
    </>
  );
}

// ── Message bubble skeleton ────────────────────────────────────────────────────
function MessageSkeleton({ isDark }) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      {[["40%", false], ["55%", true], ["35%", false], ["60%", true], ["45%", false]].map(([w, isMe], i) => (
        <div key={i} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
          <div
            className={`h-9 rounded-2xl animate-pulse ${isDark ? "bg-white/[0.05]" : "bg-neutral-200"}`}
            style={{ width: w }}
          />
        </div>
      ))}
    </div>
  );
}

// ── Date divider ───────────────────────────────────────────────────────────────
function DateDivider({ label, isDark }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className={`flex-1 h-px ${isDark ? "bg-white/[0.06]" : "bg-neutral-200"}`} />
      <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border ${
        isDark ? "text-white/30 border-white/[0.06] bg-white/[0.02]" : "text-neutral-400 border-neutral-200 bg-neutral-50"
      }`}>{label}</span>
      <div className={`flex-1 h-px ${isDark ? "bg-white/[0.06]" : "bg-neutral-200"}`} />
    </div>
  );
}

// ── Peer info panel (slides in from right) ─────────────────────────────────────
function PeerInfoPanel({ peer, isDark, onClose, navigate }) {
  return (
    <motion.div
      key="info-panel"
      initial={{ x: 60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 60, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={`w-[260px] shrink-0 flex flex-col border-l ${
        isDark ? "bg-[#111111] border-white/[0.07]" : "bg-white border-neutral-200"
      }`}
    >
      {/* Panel header — matches ProfilePage section header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? "border-white/[0.07]" : "border-neutral-100"}`}>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-lg ${isDark ? "bg-white/[0.05]" : "bg-neutral-100"}`}>
            <Info size={11} className="text-[#e2593b]" />
          </span>
          <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-white/60" : "text-neutral-500"}`}>Partner</span>
        </div>
        <button onClick={onClose} className={`p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-white/[0.06] text-white/30" : "hover:bg-neutral-100 text-neutral-400"}`}>
          <X size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Avatar + name */}
        <div className="flex flex-col items-center text-center gap-2 pt-1">
          <UserAvatar user={peer} size="2xl" className="rounded-[20px]" />
          <div>
            <p className={`text-sm font-black uppercase tracking-tight mt-2 ${isDark ? "text-white" : "text-neutral-900"}`}>{peer?.name}</p>
            <p className={`text-[10px] font-medium mt-0.5 ${isDark ? "text-white/40" : "text-neutral-400"}`}>
              {peer?.online ? <span className="text-emerald-500">● Online</span> : "Skill partner"}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Teaches", value: peer?.skillsOffered?.length || 0 },
            { label: "Learning", value: peer?.skillsWanted?.length || 0 },
          ].map(({ label, value }) => (
            <div key={label} className={`rounded-xl p-3 text-center border ${isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-neutral-50 border-neutral-200"}`}>
              <p className={`text-xl font-black tracking-tight ${isDark ? "text-white" : "text-neutral-900"}`}>{value}</p>
              <p className={`text-[9px] font-bold uppercase tracking-widest mt-0.5 ${isDark ? "text-white/30" : "text-neutral-400"}`}>{label}</p>
            </div>
          ))}
        </div>

        {/* Skills offered */}
        {peer?.skillsOffered?.length > 0 && (
          <div>
            <p className={`text-[9px] font-bold uppercase tracking-widest mb-2 ${isDark ? "text-white/30" : "text-neutral-400"}`}>Can teach</p>
            <div className="flex flex-wrap gap-1.5">
              {peer.skillsOffered.map((s) => (
                <span key={s} className="text-[10px] font-semibold px-2 py-1 rounded-lg border bg-[#e2593b]/10 border-[#e2593b]/20 text-[#e2593b]">{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* Skills wanted */}
        {peer?.skillsWanted?.length > 0 && (
          <div>
            <p className={`text-[9px] font-bold uppercase tracking-widest mb-2 ${isDark ? "text-white/30" : "text-neutral-400"}`}>Wants to learn</p>
            <div className="flex flex-wrap gap-1.5">
              {peer.skillsWanted.map((s) => (
                <span key={s} className={`text-[10px] font-semibold px-2 py-1 rounded-lg border ${isDark ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400" : "bg-indigo-50 border-indigo-200 text-indigo-600"}`}>{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* View profile CTA */}
        <button
          onClick={() => navigate(`/profile/${peer?.uid}`)}
          className={`w-full py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
            isDark ? "border-white/10 hover:bg-white/[0.04] text-white" : "border-neutral-200 hover:bg-neutral-50 text-neutral-700"
          }`}
        >
          View full profile <ChevronRight size={11} />
        </button>
      </div>
    </motion.div>
  );
}

// ── Empty states ──────────────────────────────────────────────────────────────
function EmptyState({ isDark }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8">
      <div className={`w-16 h-16 rounded-[20px] border flex items-center justify-center ${isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-neutral-50 border-neutral-200"}`}>
        <MessageSquare size={24} className="text-[#e2593b] opacity-60" />
      </div>
      <div className="text-center">
        <p className={`font-black text-sm uppercase tracking-tight ${isDark ? "text-white" : "text-neutral-900"}`}>No conversation selected</p>
        <p className={`text-[11px] font-medium mt-1.5 max-w-[200px] leading-relaxed ${isDark ? "text-white/35" : "text-neutral-400"}`}>
          Pick a match from the sidebar to start chatting
        </p>
      </div>
    </div>
  );
}

function NoMatchesState({ isDark, navigate }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8">
      <div className={`w-16 h-16 rounded-[20px] border flex items-center justify-center ${isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-neutral-50 border-neutral-200"}`}>
        <Sparkles size={24} className="text-[#e2593b] opacity-50" />
      </div>
      <div className="text-center">
        <p className={`font-black text-sm uppercase tracking-tight ${isDark ? "text-white" : "text-neutral-900"}`}>No matches yet</p>
        <p className={`text-[11px] font-medium mt-1.5 max-w-[220px] leading-relaxed ${isDark ? "text-white/35" : "text-neutral-400"}`}>
          Swipe on profiles to find skill partners, then chat here.
        </p>
      </div>
      <button
        onClick={() => navigate("/swipe")}
        className="mt-1 px-5 py-2.5 bg-[#e2593b] text-white rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-[#cc4e33] transition-colors active:scale-95"
      >
        Start discovering
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ChatPage() {
  const { user, loading: authLoading } = useAuth();
  const { isDark } = useTheme();

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const matchFromUrl = searchParams.get("matchId");

  const [matches, setMatches] = useState([]);
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [matchesError, setMatchesError] = useState(null);

  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [peerProfiles, setPeerProfiles] = useState({});

  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState(null);

  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [showSidebar, setShowSidebar] = useState(true);

  // ── new UI state ──────────────────────────────────────────────────────────
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null); // { id, text }
  const [starredMsgIds, setStarredMsgIds] = useState(new Set());
  const [hoveredMsgId, setHoveredMsgId] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const currentUid = user?.uid ?? null;

  // ── attachment state ──────────────────────────────────────────────────────
  // Each entry: { id, file, previewUrl, type: "image"|"file", uploading, error }
  const [attachments, setAttachments] = useState([]);

  const MAX_FILE_SIZE_MB = 10;
  const ACCEPTED_TYPES = "image/*,application/pdf,.doc,.docx,.txt,.zip,.mp4,.mp3";

  const handleAttachFiles = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // reset so same file can be re-selected
    if (!files.length) return;

    const next = files
      .filter((f) => {
        if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
          setSendError(`"${f.name}" exceeds ${MAX_FILE_SIZE_MB} MB limit.`);
          return false;
        }
        return true;
      })
      .map((f) => ({
        id: `${Date.now()}-${Math.random()}`,
        file: f,
        previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
        type: f.type.startsWith("image/") ? "image" : "file",
        uploading: false,
        error: null,
      }));

    setAttachments((prev) => [...prev, ...next]);
  };

  const removeAttachment = (id) => {
    setAttachments((prev) => {
      const hit = prev.find((a) => a.id === id);
      if (hit?.previewUrl) URL.revokeObjectURL(hit.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  };

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      attachments.forEach((a) => { if (a.previewUrl) URL.revokeObjectURL(a.previewUrl); });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* SOCKET */
  useEffect(() => {
    if (user?.uid) connectSocket();
    return () => disconnectSocket();
  }, [user?.uid]);

  /* PEER PROFILE */
  const loadPeerProfile = useCallback(async (peerUid) => {
    if (!peerUid) return;
    try {
      const userProfile = await getUserProfile(peerUid);
      setPeerProfiles((prev) => {
        if (prev[peerUid]) return prev;
        return {
          ...prev,
          [peerUid]: userProfile
            ? {
                id: peerUid,
                uid: peerUid,
                name: userProfile.name || `User ${peerUid.slice(0, 6)}`,
                avatar: userProfile.avatar || getDefaultUserProfile(peerUid).avatar,
                skillsOffered: userProfile.skillsOffered || [],
                skillsWanted: userProfile.skillsWanted || [],
                online: false,
                unread: 0,
              }
            : getDefaultUserProfile(peerUid),
        };
      });
    } catch {
      setPeerProfiles((prev) => {
        if (prev[peerUid]) return prev;
        return { ...prev, [peerUid]: getDefaultUserProfile(peerUid) };
      });
    }
  }, []);

  /* MATCHES */
  useEffect(() => {
    if (!currentUid) {
      setMatches([]);
      setMatchesLoading(false);
      return;
    }

    let snapshotReceived = false;
    setMatchesLoading(true);
    setMatchesError(null);

    const timeoutId = setTimeout(() => {
      if (!snapshotReceived) {
        setMatchesLoading(false);
        setMatchesError("Could not load matches. Check backend connection.");
      }
    }, LOADING_TIMEOUT_MS);

    const unsubscribe = subscribeToMatches(
      currentUid,
      (nextMatches) => {
        snapshotReceived = true;
        setMatches(sortMatchesByActivity(nextMatches));
        setMatchesLoading(false);
        setMatchesError(null);
      },
      (error) => {
        snapshotReceived = true;
        setMatchesError(error.message || "Failed to load matches");
        setMatchesLoading(false);
      }
    );

    return () => {
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [currentUid]);

  /* PEER FETCH */
  useEffect(() => {
    matches.forEach((match) => {
      const peerUid = getPeerUidFromMatch(match.users, currentUid);
      if (peerUid) loadPeerProfile(peerUid);
    });
  }, [matches, currentUid, loadPeerProfile]);

  /* SELECT CHAT */
  useEffect(() => {
    if (!currentUid || matchesLoading) return;
    if (matchFromUrl) {
      setSelectedMatchId(matchFromUrl);
      if (window.innerWidth < 1024) setShowSidebar(false);
      return;
    }
    if (matches.length > 0 && !selectedMatchId) {
      setSelectedMatchId(matches[0].id);
    }
  }, [matches, currentUid, matchFromUrl, matchesLoading, selectedMatchId]);

  /* LOAD MESSAGES */
  useEffect(() => {
    if (!selectedMatchId || !currentUid) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    setMessagesLoading(true);
    setMessagesError(null);
    setShowInfoPanel(false);
    setReplyingTo(null);

    (async () => {
      try {
        await ensureChatForMatch(selectedMatchId);
        const history = await fetchMatchMessages(selectedMatchId);
        if (!cancelled) {
          setMessages(history);
          setMessagesLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setMessagesError(e.message);
          setMessagesLoading(false);
        }
      }
    })();

    joinMatchRoom(selectedMatchId, currentUid);

    const offMessage = onNewMessage((raw) => {
      if (raw.matchId !== selectedMatchId) return;
      setMessages((prev) => mergeMessages(prev, [normalizeSocketMessage(raw)]));
    });

    const offError = onChatError((err) => setSendError(err.message));

    return () => {
      cancelled = true;
      leaveMatchRoom(selectedMatchId);
      offMessage();
      offError();
    };
  }, [selectedMatchId, currentUid]);

  /* AUTO SCROLL */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const uiMessages = useMemo(
    () =>
      messages.map((msg) => ({
        id: msg.id,
        sender: msg.senderId === currentUid ? "me" : "them",
        isDeleted: msg.isDeleted,
        text: msg.isDeleted ? "This message was unsent" : msg.text,
        time: formatMessageTime(msg.timestamp),
      })),
    [messages, currentUid]
  );

  /* SEND */
  const handleSend = async () => {
    const text = messageInput.trim();
    const hasAttachments = attachments.length > 0;
    if ((!text && !hasAttachments) || sending || !selectedMatchId) return;

    setSending(true);
    setSendError(null);
    setReplyingTo(null);

    try {
      // Send text message if present
      if (text) {
        const saved = await sendMessage(selectedMatchId, currentUid, text);
        setMessages((prev) => mergeMessages(prev, [saved]));
        setMessageInput("");
      }

      // Send each attachment as a separate message
      // sendMessage is expected to accept an optional `file` payload;
      // if your chatService doesn't support it yet, the attachment
      // optimistically renders locally and you can wire the upload later.
      for (const att of attachments) {
        try {
          // Build a FormData or pass the File object — adjust to your chatService API
          const saved = await sendMessage(selectedMatchId, currentUid, att.file.name, { file: att.file });
          setMessages((prev) => mergeMessages(prev, [saved]));
        } catch {
          // Optimistic local fallback so the UI doesn't silently fail
          const localMsg = {
            id: att.id,
            senderId: currentUid,
            text: att.file.name,
            timestamp: new Date().toISOString(),
            _localAttachment: att,
          };
          setMessages((prev) => mergeMessages(prev, [localMsg]));
        }
      }

      // Clear attachments
      attachments.forEach((a) => { if (a.previewUrl) URL.revokeObjectURL(a.previewUrl); });
      setAttachments([]);
      inputRef.current?.focus();
    } catch (e) {
      setSendError(e.message);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (messageInput.trim() || attachments.length > 0) handleSend();
    }
    if (e.key === "Escape" && replyingTo) setReplyingTo(null);
  };

  const handleSelectMatch = (matchId) => {
    setSelectedMatchId(matchId);
    if (window.innerWidth < 1024) setShowSidebar(false);
    setSearchParams(matchId ? { matchId } : {});
  };

  const toggleStar = (msgId) => {
    setStarredMsgIds((prev) => {
      const next = new Set(prev);
      next.has(msgId) ? next.delete(msgId) : next.add(msgId);
      return next;
    });
  };

  const filteredMatches = useMemo(() => {
    if (!searchQuery.trim()) return matches;
    const q = searchQuery.toLowerCase();
    return matches.filter((match) => {
      const peerUid = getPeerUidFromMatch(match.users, currentUid);
      const profile = peerProfiles[peerUid];
      return profile?.name?.toLowerCase().includes(q);
    });
  }, [matches, searchQuery, currentUid, peerProfiles]);

  const selectedMatch = matches.find((m) => m.id === selectedMatchId);
  const selectedPeerUid = selectedMatch ? getPeerUidFromMatch(selectedMatch.users, currentUid) : null;
  const selectedPeer = selectedPeerUid ? peerProfiles[selectedPeerUid] : null;

  /* AUTH LOADING */
  if (authLoading) {
    return (
      <div className={`h-[calc(100dvh-5rem)] w-full flex items-center justify-center ${isDark ? "bg-[#0b0b0b]" : "bg-[#fcfcfc]"}`}>
        <Loader2 className="animate-spin text-[#e2593b]" size={36} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`h-[calc(100dvh-5rem)] w-full flex flex-col items-center justify-center gap-4 ${isDark ? "bg-[#0b0b0b]" : "bg-[#fcfcfc]"}`}>
        <div className={`w-16 h-16 rounded-[20px] border flex items-center justify-center ${isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-neutral-50 border-neutral-200"}`}>
          <MessageSquare size={24} className="text-[#e2593b] opacity-60" />
        </div>
        <p className={`font-black text-sm uppercase tracking-tight ${isDark ? "text-white" : "text-neutral-900"}`}>Sign in to view messages</p>
        <button
          onClick={() => navigate("/login")}
          className="px-5 py-2.5 bg-[#e2593b] text-white rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-[#cc4e33] transition-colors flex items-center gap-2 active:scale-95"
        >
          <LogIn size={13} /> Sign in
        </button>
      </div>
    );
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className={`w-full h-[calc(100dvh-5rem)] min-h-0 overflow-hidden border-t ${isDark ? "bg-[#0b0b0b] text-white border-white/[0.04]" : "bg-[#f5f5f5] text-neutral-900 border-neutral-200"}`}>
      <div className="flex h-full min-h-0">

        {/* ══════════════════════════════════
            SIDEBAR
        ══════════════════════════════════ */}
        <AnimatePresence initial={false}>
          {(showSidebar || window.innerWidth >= 1024) && (
            <motion.aside
              key="sidebar"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className={`
                ${showSidebar ? "flex" : "hidden"} lg:flex
                flex-col w-full sm:w-[290px] lg:w-[290px] shrink-0 min-h-0 border-r
                ${isDark ? "bg-[#111111] border-white/[0.07]" : "bg-white border-neutral-200"}
              `}
            >
              {/* Sidebar header — ProfilePage section-header style */}
              <div className={`px-4 pt-5 pb-3 border-b ${isDark ? "border-white/[0.07]" : "border-neutral-100"}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${isDark ? "bg-white/[0.05]" : "bg-neutral-100"}`}>
                      <MessageSquare size={13} className="text-[#e2593b]" />
                    </span>
                    <h2 className={`text-[11px] font-bold uppercase tracking-widest ${isDark ? "text-white" : "text-neutral-800"}`}>
                      Messages
                    </h2>
                  </div>
                  {matches.length > 0 && (
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${isDark ? "bg-white/[0.06] border-white/[0.08] text-neutral-300" : "bg-neutral-100 border-neutral-200 text-neutral-500"}`}>
                      {matches.length}
                    </span>
                  )}
                </div>

                {/* Search */}
                <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${isDark ? "bg-white/[0.03] border-white/[0.07]" : "bg-neutral-50 border-neutral-200"}`}>
                  <Search size={12} className={isDark ? "text-white/30" : "text-neutral-400"} />
                  <input
                    className={`flex-1 text-xs outline-none bg-transparent font-medium ${isDark ? "text-white placeholder:text-white/25" : "text-neutral-900 placeholder:text-neutral-400"}`}
                    placeholder="Search conversations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className={`${isDark ? "text-white/30 hover:text-white/60" : "text-neutral-300 hover:text-neutral-500"}`}>
                      <X size={11} />
                    </button>
                  )}
                </div>
              </div>

              {/* Match list */}
              <div className="flex-1 overflow-y-auto py-2 px-1">
                {matchesLoading ? (
                  <MatchSkeleton isDark={isDark} />
                ) : matchesError ? (
                  <div className={`m-3 p-3 rounded-xl border text-center ${isDark ? "bg-rose-500/5 border-rose-500/10" : "bg-rose-50 border-rose-100"}`}>
                    <p className={`text-[10px] font-medium ${isDark ? "text-rose-400" : "text-rose-500"}`}>{matchesError}</p>
                  </div>
                ) : filteredMatches.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className={`text-xs font-medium ${isDark ? "text-white/30" : "text-neutral-400"}`}>
                      {searchQuery ? "No results found" : "No matches yet"}
                    </p>
                    {!searchQuery && (
                      <button onClick={() => navigate("/swipe")} className="mt-3 text-[10px] font-bold uppercase tracking-wider text-[#e2593b] hover:underline">
                        Discover people →
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <p className={`text-[9px] font-bold uppercase tracking-widest px-3 py-2 ${isDark ? "text-white/20" : "text-neutral-400"}`}>
                      Conversations
                    </p>
                    {filteredMatches.map((match) => {
                      const peerUid = getPeerUidFromMatch(match.users, currentUid);
                      const peer = peerProfiles[peerUid];
                      const isSelected = match.id === selectedMatchId;
                      const lastMsgText = match.lastMessage?.text || null;
                      const lastMsgTime = match.lastMessage?.timestamp
                        ? formatRelativeTime(match.lastMessage.timestamp)
                        : null;

                      return (
                        <button
                          key={match.id}
                          onClick={() => handleSelectMatch(match.id)}
                          className={`
                            w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition-all mb-0.5 border
                            ${isSelected
                              ? isDark
                                ? "bg-white/[0.06] border-white/[0.08]"
                                : "bg-[#e2593b]/[0.07] border-[#e2593b]/[0.15]"
                              : isDark
                                ? "border-transparent hover:bg-white/[0.03]"
                                : "border-transparent hover:bg-neutral-50"
                            }
                          `}
                        >
                          <div className="relative shrink-0">
                            <UserAvatar user={peer} size="md" className="rounded-xl" />
                            {peer?.online && (
                              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-inherit" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-[11px] font-bold truncate uppercase tracking-tight ${isDark ? "text-white" : "text-neutral-900"}`}>
                                {peer?.name || `User ${(peerUid || "").slice(0, 6)}`}
                              </span>
                              {lastMsgTime && (
                                <span className={`text-[9px] font-medium shrink-0 ${isDark ? "text-white/25" : "text-neutral-400"}`}>
                                  {lastMsgTime}
                                </span>
                              )}
                            </div>
                            {lastMsgText ? (
                              <p className={`text-[11px] truncate mt-0.5 font-medium ${isDark ? "text-white/35" : "text-neutral-500"}`}>
                                {lastMsgText}
                              </p>
                            ) : peer?.skillsOffered?.length > 0 ? (
                              <p className={`text-[11px] truncate mt-0.5 font-medium ${isDark ? "text-white/25" : "text-neutral-400"}`}>
                                Teaches {peer.skillsOffered.slice(0, 2).join(", ")}
                              </p>
                            ) : (
                              <p className={`text-[11px] mt-0.5 font-medium ${isDark ? "text-white/15" : "text-neutral-300"}`}>
                                New match
                              </p>
                            )}
                          </div>

                          {isSelected && <ChevronRight size={11} className="shrink-0 text-[#e2593b] opacity-60" />}
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* ══════════════════════════════════
            MAIN CHAT AREA
        ══════════════════════════════════ */}
        <main className={`flex-1 flex flex-col min-w-0 min-h-0 ${isDark ? "bg-[#0b0b0b]" : "bg-[#f5f5f5]"}`}>

          {/* Chat header */}
          {selectedPeer ? (
            <div className={`flex items-center gap-3 px-4 py-3 border-b flex-shrink-0 ${isDark ? "bg-[#111111] border-white/[0.07]" : "bg-white border-neutral-200"}`}>
              <button
                className="lg:hidden p-1.5 rounded-lg transition-colors active:scale-90"
                onClick={() => setShowSidebar(true)}
              >
                <ArrowLeft size={15} className={isDark ? "text-white/50" : "text-neutral-500"} />
              </button>

              {/* Clickable peer — goes to profile */}
              <button
                onClick={() => navigate(`/profile/${selectedPeer.uid}`)}
                className="flex items-center gap-3 flex-1 min-w-0 text-left group"
              >
                <div className="relative shrink-0">
                  <UserAvatar user={selectedPeer} size="md" className="rounded-xl group-hover:opacity-85 transition-opacity" />
                  {selectedPeer.online && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-inherit" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className={`text-[11px] font-black uppercase tracking-tight ${isDark ? "text-white" : "text-neutral-900"}`}>
                    {selectedPeer.name}
                  </p>
                  <p className={`text-[10px] font-medium mt-0.5 ${isDark ? "text-white/35" : "text-neutral-400"}`}>
                    {selectedPeer.online
                      ? <span className="text-emerald-500">● Online</span>
                      : selectedPeer.skillsOffered?.length > 0
                        ? `Teaches ${selectedPeer.skillsOffered.slice(0, 2).join(", ")}`
                        : "Skill partner"
                    }
                  </p>
                </div>
              </button>

              {/* Header actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setShowInfoPanel((p) => !p)}
                  title="Partner info"
                  className={`p-2 rounded-xl transition-colors ${
                    showInfoPanel
                      ? isDark ? "bg-white/[0.08] text-white" : "bg-[#e2593b]/10 text-[#e2593b]"
                      : isDark ? "hover:bg-white/[0.05] text-white/35" : "hover:bg-neutral-100 text-neutral-400"
                  }`}
                >
                  <Info size={14} />
                </button>
              </div>
            </div>
          ) : (
            <div className={`h-[53px] border-b flex-shrink-0 flex items-center px-4 ${isDark ? "bg-[#111111] border-white/[0.07]" : "bg-white border-neutral-200"}`}>
              {!showSidebar && (
                <button className="p-1.5 rounded-lg" onClick={() => setShowSidebar(true)}>
                  <ArrowLeft size={15} className={isDark ? "text-white/50" : "text-neutral-500"} />
                </button>
              )}
            </div>
          )}

          {/* Content row */}
          <div className="flex flex-1 min-h-0">
            <div className="flex-1 flex flex-col min-w-0 min-h-0">

              {/* Messages or empty states */}
              {!selectedMatchId ? (
                matchesLoading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="animate-spin text-[#e2593b]" size={28} />
                  </div>
                ) : matches.length === 0 ? (
                  <NoMatchesState isDark={isDark} navigate={navigate} />
                ) : (
                  <EmptyState isDark={isDark} />
                )
              ) : (
                <>
                  {/* Message list */}
                  <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
                    {messagesLoading ? (
                      <MessageSkeleton isDark={isDark} />
                    ) : messagesError ? (
                      <div className={`m-4 p-4 rounded-2xl border text-center ${isDark ? "bg-rose-500/5 border-rose-500/10" : "bg-rose-50 border-rose-100"}`}>
                        <p className={`text-xs font-medium ${isDark ? "text-rose-400" : "text-rose-500"}`}>{messagesError}</p>
                      </div>
                    ) : uiMessages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full gap-3">
                        <div className={`w-14 h-14 rounded-[18px] border flex items-center justify-center ${isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-neutral-50 border-neutral-200"}`}>
                          <MessageSquare size={22} className="text-[#e2593b] opacity-50" />
                        </div>
                        <p className={`text-[11px] font-black uppercase tracking-tight ${isDark ? "text-white/50" : "text-neutral-500"}`}>
                          Start the conversation
                        </p>
                        <p className={`text-[10px] font-medium text-center max-w-[200px] leading-relaxed ${isDark ? "text-white/25" : "text-neutral-400"}`}>
                          Say hi and kick off your skill exchange!
                        </p>
                      </div>
                    ) : (
                      <>
                        <DateDivider label="Today" isDark={isDark} />

                        {uiMessages.map((msg, i) => {
                          const isMe = msg.sender === "me";
                          const prevMsg = uiMessages[i - 1];
                          const nextMsg = uiMessages[i + 1];
                          const isSameGroup = prevMsg?.sender === msg.sender;
                          const isLastInGroup = !nextMsg || nextMsg.sender !== msg.sender;
                          const isStarred = starredMsgIds.has(msg.id);
                          const isHovered = hoveredMsgId === msg.id;

                          return (
                            <motion.div
                              key={msg.id}
                              initial={{ opacity: 0, y: 6, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              transition={{ duration: 0.14 }}
                              className={`flex ${isMe ? "justify-end" : "justify-start"} ${isSameGroup ? "mt-0.5" : "mt-3"}`}
                              onMouseEnter={() => setHoveredMsgId(msg.id)}
                              onMouseLeave={() => setHoveredMsgId(null)}
                            >
                              {/* Peer avatar slot */}
                              {!isMe && (
                                <div className="mr-2 mt-auto shrink-0 w-7">
                                  {!isSameGroup
                                    ? <UserAvatar user={selectedPeer} size="xs" className="rounded-lg" />
                                    : null
                                  }
                                </div>
                              )}

                              <div className={`max-w-[68%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                                <div className="flex items-end gap-1.5">

                                  {/* Hover actions — left of bubble when isMe */}
                                  <AnimatePresence>
                                    {isHovered && isMe && (
                                      <motion.div
                                        initial={{ opacity: 0, scale: 0.85 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.85 }}
                                        className="flex items-center gap-0.5 mb-0.5"
                                      >
                                        <button
                                          onClick={() => setReplyingTo({ id: msg.id, text: msg.text })}
                                          title="Reply"
                                          className={`p-1.5 rounded-lg text-[11px] transition-colors ${isDark ? "hover:bg-white/[0.06] text-white/30" : "hover:bg-neutral-100 text-neutral-400"}`}
                                        >
                                          <Reply size={11} />
                                        </button>
                                        <button
                                          onClick={() => toggleStar(msg.id)}
                                          title="Star"
                                          className={`p-1.5 rounded-lg transition-colors ${isStarred ? "text-amber-400" : isDark ? "text-white/30 hover:bg-white/[0.06]" : "text-neutral-400 hover:bg-neutral-100"}`}
                                        >
                                          <Star size={11} className={isStarred ? "fill-amber-400" : ""} />
                                        </button>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>

                                  {/* Bubble */}
                                  <div
                                    className={`
                                      text-xs leading-relaxed break-words font-medium overflow-hidden
                                      ${!isSameGroup
                                        ? isMe ? "rounded-2xl rounded-br-md" : "rounded-2xl rounded-bl-md"
                                        : isMe ? "rounded-2xl rounded-tr-md rounded-br-md" : "rounded-2xl rounded-tl-md rounded-bl-md"
                                      }
                                      ${isMe
                                        ? "bg-[#e2593b] text-white"
                                        : isDark
                                          ? "bg-white/[0.07] text-white border border-white/[0.06]"
                                          : "bg-white text-neutral-900 border border-neutral-200 shadow-sm"
                                      }
                                      ${msg.isDeleted ? "italic opacity-40" : ""}
                                    `}
                                  >
                                    {/* Local image attachment preview */}
                                    {msg._localAttachment?.type === "image" && msg._localAttachment.previewUrl && (
                                      <img
                                        src={msg._localAttachment.previewUrl}
                                        alt={msg._localAttachment.file.name}
                                        className="max-w-[220px] max-h-[180px] object-cover w-full"
                                      />
                                    )}
                                    {/* Local file attachment */}
                                    {msg._localAttachment?.type === "file" && (
                                      <div className={`flex items-center gap-2 px-3 py-2.5 ${isMe ? "text-white/90" : isDark ? "text-white/80" : "text-neutral-700"}`}>
                                        <FileText size={14} className="shrink-0 opacity-70" />
                                        <span className="truncate max-w-[160px]">{msg._localAttachment.file.name}</span>
                                      </div>
                                    )}
                                    {/* Regular text */}
                                    {!msg._localAttachment && (
                                      <span className="px-4 py-2.5 block">
                                        {msg.text}
                                        {isStarred && <Star size={9} className="inline ml-1.5 fill-amber-400 text-amber-400" />}
                                      </span>
                                    )}
                                    {/* Text alongside attachment */}
                                    {msg._localAttachment && msg.text && msg.text !== msg._localAttachment.file.name && (
                                      <span className="px-3 py-2 block border-t border-white/10">{msg.text}</span>
                                    )}
                                  </div>

                                  {/* Hover actions — right of bubble when !isMe */}
                                  <AnimatePresence>
                                    {isHovered && !isMe && (
                                      <motion.div
                                        initial={{ opacity: 0, scale: 0.85 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.85 }}
                                        className="flex items-center gap-0.5 mb-0.5"
                                      >
                                        <button
                                          onClick={() => setReplyingTo({ id: msg.id, text: msg.text })}
                                          title="Reply"
                                          className={`p-1.5 rounded-lg text-[11px] transition-colors ${isDark ? "hover:bg-white/[0.06] text-white/30" : "hover:bg-neutral-100 text-neutral-400"}`}
                                        >
                                          <Reply size={11} />
                                        </button>
                                        <button
                                          onClick={() => toggleStar(msg.id)}
                                          title="Star"
                                          className={`p-1.5 rounded-lg transition-colors ${isStarred ? "text-amber-400" : isDark ? "text-white/30 hover:bg-white/[0.06]" : "text-neutral-400 hover:bg-neutral-100"}`}
                                        >
                                          <Star size={11} className={isStarred ? "fill-amber-400" : ""} />
                                        </button>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>

                                {/* Timestamp + read check */}
                                {isLastInGroup && msg.time && (
                                  <span className={`text-[9px] font-medium mt-1 px-1 flex items-center gap-1 ${isDark ? "text-white/20" : "text-neutral-400"}`}>
                                    {isMe && <Check size={9} className="opacity-50" />}
                                    {msg.time}
                                  </span>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}
                        <div ref={messagesEndRef} />
                      </>
                    )}
                  </div>

                  {/* Input bar */}
                  <div className={`flex-shrink-0 px-4 py-3 border-t ${isDark ? "bg-[#111111] border-white/[0.07]" : "bg-white border-neutral-200"}`}>

                    {/* Reply preview */}
                    <AnimatePresence>
                      {replyingTo && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden mb-2"
                        >
                          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border-l-2 border-[#e2593b] ${isDark ? "bg-white/[0.03]" : "bg-neutral-50"}`}>
                            <span className={`text-[10px] font-medium flex-1 truncate ${isDark ? "text-white/45" : "text-neutral-500"}`}>
                              Replying to {replyingTo.text}
                            </span>
                            <button onClick={() => setReplyingTo(null)} className={`${isDark ? "text-white/25 hover:text-white/50" : "text-neutral-300 hover:text-neutral-500"}`}>
                              <X size={11} />
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Send error */}
                    <AnimatePresence>
                      {sendError && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden mb-2"
                        >
                          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${isDark ? "bg-rose-500/5 border-rose-500/10" : "bg-rose-50 border-rose-100"}`}>
                            <p className={`text-[10px] font-medium flex-1 ${isDark ? "text-rose-400" : "text-rose-500"}`}>{sendError}</p>
                            <button onClick={() => setSendError(null)} className="text-rose-400"><X size={11} /></button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Hidden file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept={ACCEPTED_TYPES}
                      className="hidden"
                      onChange={handleAttachFiles}
                    />

                    {/* Attachment preview strip */}
                    <AnimatePresence>
                      {attachments.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden mb-2"
                        >
                          <div className="flex flex-wrap gap-2 px-1">
                            {attachments.map((att) => (
                              <div
                                key={att.id}
                                className={`relative flex items-center gap-2 rounded-xl border overflow-hidden ${
                                  isDark ? "bg-white/[0.04] border-white/[0.08]" : "bg-neutral-50 border-neutral-200"
                                } ${att.type === "image" ? "p-0" : "px-3 py-2"}`}
                              >
                                {att.type === "image" ? (
                                  <img
                                    src={att.previewUrl}
                                    alt={att.file.name}
                                    className="w-16 h-16 object-cover"
                                  />
                                ) : (
                                  <>
                                    <FileText size={14} className={isDark ? "text-white/40" : "text-neutral-400"} />
                                    <span className={`text-[10px] font-medium max-w-[120px] truncate ${isDark ? "text-white/60" : "text-neutral-600"}`}>
                                      {att.file.name}
                                    </span>
                                    <span className={`text-[9px] ${isDark ? "text-white/25" : "text-neutral-400"}`}>
                                      {(att.file.size / 1024).toFixed(0)} KB
                                    </span>
                                  </>
                                )}
                                {/* Remove button */}
                                <button
                                  onClick={() => removeAttachment(att.id)}
                                  className={`absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center transition-colors ${
                                    isDark ? "bg-black/60 hover:bg-black/80 text-white/70" : "bg-white/80 hover:bg-white text-neutral-600 shadow-sm"
                                  }`}
                                >
                                  <X size={9} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Composer */}
                    <div className={`flex items-end gap-2 p-1.5 rounded-2xl border transition-colors ${isDark ? "bg-white/[0.03] border-white/[0.07]" : "bg-neutral-50 border-neutral-200"}`}>
                      <button className={`p-2 rounded-xl transition-colors self-end ${isDark ? "text-white/25 hover:text-white/50 hover:bg-white/[0.04]" : "text-neutral-300 hover:text-neutral-500 hover:bg-neutral-100"}`}>
                        <Smile size={15} />
                      </button>

                      <textarea
                        ref={inputRef}
                        rows={1}
                        value={messageInput}
                        onChange={(e) => {
                          setMessageInput(e.target.value);
                          e.target.style.height = "auto";
                          e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder={attachments.length > 0 ? "Add a caption..." : "Write a message..."}
                        className={`
                          flex-1 resize-none px-2 py-2 text-xs outline-none bg-transparent
                          max-h-[120px] leading-relaxed font-medium
                          ${isDark ? "text-white placeholder:text-white/25 caret-white" : "text-neutral-900 placeholder:text-neutral-400"}
                        `}
                        style={{ overflowY: "auto" }}
                      />

                      {/* Attachment button — now wired */}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        title="Attach file or image"
                        className={`p-2 rounded-xl transition-colors self-end ${
                          attachments.length > 0
                            ? "text-[#e2593b]"
                            : isDark
                              ? "text-white/25 hover:text-white/50 hover:bg-white/[0.04]"
                              : "text-neutral-300 hover:text-neutral-500 hover:bg-neutral-100"
                        }`}
                      >
                        <Paperclip size={15} />
                      </button>

                      <button
                        onClick={handleSend}
                        disabled={(!messageInput.trim() && attachments.length === 0) || sending}
                        className={`
                          self-end shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90
                          ${(messageInput.trim() || attachments.length > 0) && !sending
                            ? "bg-[#e2593b] text-white hover:bg-[#cc4e33] shadow-sm"
                            : isDark ? "bg-white/[0.05] text-white/20" : "bg-neutral-200 text-neutral-400"
                          }
                        `}
                      >
                        {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      </button>
                    </div>

                    <p className={`text-[9px] font-medium text-center mt-1.5 ${isDark ? "text-white/10" : "text-neutral-300"}`}>
                      Enter to send / Shift+Enter for new line / Esc to cancel reply
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* ── PEER INFO PANEL ── */}
            <AnimatePresence>
              {showInfoPanel && selectedPeer && (
                <PeerInfoPanel
                  peer={selectedPeer}
                  isDark={isDark}
                  onClose={() => setShowInfoPanel(false)}
                  navigate={navigate}
                  matchId={selectedMatchId}
                />
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
