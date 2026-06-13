// ChatPage - responsive realtime messaging layout with user list sidebar
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import {
  Send,
  Search,
  ArrowLeft,
  LogIn,
  Loader2,
  MessageSquare,
  CheckCheck,
  Smile,
  MoreVertical,
  Phone,
  Video,
  Info,
  ChevronRight,
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

function EmptyState({ isDark }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8">
      <div className={`w-20 h-20 rounded-3xl flex items-center justify-center ${isDark ? "bg-white/5" : "bg-neutral-100"}`}>
        <MessageSquare size={32} className="text-[#e2593b] opacity-70" />
      </div>
      <div className="text-center">
        <p className={`font-semibold text-lg ${isDark ? "text-white" : "text-neutral-900"}`}>No conversation selected</p>
        <p className={`text-sm mt-1 ${isDark ? "text-white/40" : "text-neutral-400"}`}>
          Pick a match from the sidebar to start chatting
        </p>
      </div>
    </div>
  );
}

function NoMatchesState({ isDark, navigate }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8">
      <div className={`w-20 h-20 rounded-3xl flex items-center justify-center ${isDark ? "bg-white/5" : "bg-neutral-100"}`}>
        <MessageSquare size={32} className="text-[#e2593b] opacity-50" />
      </div>
      <div className="text-center">
        <p className={`font-semibold text-lg ${isDark ? "text-white" : "text-neutral-900"}`}>No matches yet</p>
        <p className={`text-sm mt-2 max-w-xs ${isDark ? "text-white/40" : "text-neutral-400"}`}>
          Swipe on profiles to find skill partners, then chat with your matches here.
        </p>
      </div>
      <button
        onClick={() => navigate("/swipe")}
        className="mt-2 px-5 py-2.5 bg-[#e2593b] text-white rounded-xl text-sm font-semibold hover:bg-[#cc4e33] transition-colors"
      >
        Start discovering
      </button>
    </div>
  );
}

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

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const currentUid = user?.uid ?? null;

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
  }, [matches, currentUid, matchFromUrl, matchesLoading]);

  /* LOAD MESSAGES */
  useEffect(() => {
    if (!selectedMatchId || !currentUid) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    setMessagesLoading(true);
    setMessagesError(null);

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
    if (!text || sending || !selectedMatchId) return;
    setSending(true);
    setSendError(null);
    try {
      const saved = await sendMessage(selectedMatchId, currentUid, text);
      setMessages((prev) => mergeMessages(prev, [saved]));
      setMessageInput("");
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
      handleSend();
    }
  };

  const handleSelectMatch = (matchId) => {
    setSelectedMatchId(matchId);
    if (window.innerWidth < 1024) setShowSidebar(false);
    setSearchParams(matchId ? { matchId } : {});
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
  const selectedPeerUid = selectedMatch
    ? getPeerUidFromMatch(selectedMatch.users, currentUid)
    : null;
  const selectedPeer = selectedPeerUid ? peerProfiles[selectedPeerUid] : null;

  /* AUTH LOADING */
  if (authLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-[#e2593b]" size={36} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <MessageSquare size={40} className="text-[#e2593b] opacity-60" />
        <p className={`font-semibold ${isDark ? "text-white" : "text-neutral-900"}`}>Sign in to view messages</p>
        <button
          onClick={() => navigate("/login")}
          className="px-5 py-2.5 bg-[#e2593b] text-white rounded-xl text-sm font-semibold hover:bg-[#cc4e33] transition-colors flex items-center gap-2"
        >
          <LogIn size={16} /> Sign in
        </button>
      </div>
    );
  }

  return (
    <div className={`w-full h-full overflow-hidden ${isDark ? "bg-[#0b0b0b] text-white" : "bg-[#f5f5f5] text-black"}`}>
      <div className="flex h-full">

        {/* ── SIDEBAR ── */}
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
                flex-col w-full sm:w-[300px] lg:w-[320px] shrink-0
                border-r
                ${isDark ? "bg-[#111111] border-white/[0.07]" : "bg-white border-neutral-200"}
              `}
            >
              {/* Sidebar header */}
              <div className={`px-4 pt-5 pb-3 border-b ${isDark ? "border-white/[0.07]" : "border-neutral-100"}`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className={`text-lg font-bold tracking-tight ${isDark ? "text-white" : "text-neutral-900"}`}>
                    Messages
                  </h2>
                  {matches.length > 0 && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isDark ? "bg-white/10 text-white/60" : "bg-neutral-100 text-neutral-500"}`}>
                      {matches.length}
                    </span>
                  )}
                </div>

                {/* Search */}
                <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${isDark ? "bg-white/5 border-white/10 text-white" : "bg-neutral-50 border-neutral-200 text-black"}`}>
                  <Search size={14} className={isDark ? "text-white/40" : "text-neutral-400"} />
                  <input
                    className={`flex-1 text-sm outline-none bg-transparent ${isDark ? "text-white placeholder:text-white/30" : "text-black placeholder:text-neutral-400"}`}
                    placeholder="Search conversations…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* Match list */}
              <div className="flex-1 overflow-y-auto py-2">
                {matchesLoading ? (
                  <div className="flex flex-col gap-2 p-3">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${isDark ? "bg-white/5" : "bg-neutral-100"} animate-pulse`}>
                        <div className={`w-10 h-10 rounded-full shrink-0 ${isDark ? "bg-white/10" : "bg-neutral-200"}`} />
                        <div className="flex-1 space-y-2">
                          <div className={`h-3 rounded-full w-2/3 ${isDark ? "bg-white/10" : "bg-neutral-200"}`} />
                          <div className={`h-2.5 rounded-full w-1/2 ${isDark ? "bg-white/5" : "bg-neutral-100"}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : matchesError ? (
                  <div className="p-4 text-center">
                    <p className={`text-xs ${isDark ? "text-white/40" : "text-neutral-400"}`}>{matchesError}</p>
                  </div>
                ) : filteredMatches.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className={`text-sm ${isDark ? "text-white/40" : "text-neutral-400"}`}>
                      {searchQuery ? "No results found" : "No matches yet"}
                    </p>
                    {!searchQuery && (
                      <button
                        onClick={() => navigate("/swipe")}
                        className="mt-3 text-xs text-[#e2593b] hover:underline font-medium"
                      >
                        Discover people →
                      </button>
                    )}
                  </div>
                ) : (
                  filteredMatches.map((match) => {
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
                          w-full flex items-center gap-3 px-3 py-3 mx-1 rounded-xl text-left transition-all
                          ${isSelected
                            ? isDark
                              ? "bg-white/[0.08] ring-1 ring-white/10"
                              : "bg-[#e2593b]/10 ring-1 ring-[#e2593b]/20"
                            : isDark
                              ? "hover:bg-white/5"
                              : "hover:bg-neutral-50"
                          }
                        `}
                        style={{ width: "calc(100% - 8px)" }}
                      >
                        {/* Avatar */}
                        <div className="relative shrink-0">
                          <UserAvatar
                            user={peer}
                            size="md"
                            className={isSelected ? "ring-2 ring-[#e2593b]/50" : ""}
                          />
                          {peer?.online && (
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-inherit" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className={`text-sm font-semibold truncate ${isDark ? "text-white" : "text-neutral-900"}`}>
                              {peer?.name || `User ${(peerUid || "").slice(0, 6)}`}
                            </span>
                            {lastMsgTime && (
                              <span className={`text-[10px] shrink-0 ml-2 ${isDark ? "text-white/30" : "text-neutral-400"}`}>
                                {lastMsgTime}
                              </span>
                            )}
                          </div>

                          {/* Last message preview or skill tags */}
                          {lastMsgText ? (
                            <p className={`text-xs truncate mt-0.5 ${isDark ? "text-white/40" : "text-neutral-400"}`}>
                              {lastMsgText}
                            </p>
                          ) : peer?.skillsOffered?.length > 0 ? (
                            <p className={`text-xs truncate mt-0.5 ${isDark ? "text-white/30" : "text-neutral-400"}`}>
                              Offers: {peer.skillsOffered.slice(0, 2).join(", ")}
                            </p>
                          ) : (
                            <p className={`text-xs mt-0.5 ${isDark ? "text-white/20" : "text-neutral-300"}`}>
                              New match
                            </p>
                          )}
                        </div>
                        {isSelected && <ChevronRight size={14} className="shrink-0 text-[#e2593b] opacity-70" />}
                      </button>
                    );
                  })
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* ── MAIN CHAT AREA ── */}
        <main className={`flex-1 flex flex-col min-w-0 ${isDark ? "bg-[#0b0b0b]" : "bg-[#f8f8f8]"}`}>

          {/* Chat header */}
          {selectedPeer ? (
            <div className={`flex items-center gap-3 px-4 py-3 border-b ${isDark ? "bg-[#111111] border-white/[0.07]" : "bg-white border-neutral-200"}`}>
              {/* Mobile back button */}
              <button
                className="lg:hidden p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                onClick={() => setShowSidebar(true)}
              >
                <ArrowLeft size={18} className={isDark ? "text-white" : "text-neutral-700"} />
              </button>

              <div className="relative">
                <UserAvatar user={selectedPeer} size="md" />
                {selectedPeer.online && (
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-inherit" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm ${isDark ? "text-white" : "text-neutral-900"}`}>
                  {selectedPeer.name}
                </p>
                <p className={`text-xs ${isDark ? "text-white/40" : "text-neutral-400"}`}>
                  {selectedPeer.online ? "Online" : "Skill partner"}
                </p>
              </div>

              {/* Header actions */}
              <div className="flex items-center gap-1">
                <button className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-white/10 text-white/60" : "hover:bg-neutral-100 text-neutral-400"}`}>
                  <Info size={16} />
                </button>
                <button className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-white/10 text-white/60" : "hover:bg-neutral-100 text-neutral-400"}`}>
                  <MoreVertical size={16} />
                </button>
              </div>
            </div>
          ) : !matchesLoading && matches.length === 0 ? null : (
            <div className={`h-[57px] border-b ${isDark ? "bg-[#111111] border-white/[0.07]" : "bg-white border-neutral-200"}`}>
              {/* Mobile back button when no peer selected */}
              {!showSidebar && (
                <button className="lg:hidden p-3" onClick={() => setShowSidebar(true)}>
                  <ArrowLeft size={18} />
                </button>
              )}
            </div>
          )}

          {/* Messages area */}
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
              <div className="flex-1 overflow-y-auto px-4 py-5 space-y-1">
                {messagesLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="animate-spin text-[#e2593b]" size={24} />
                  </div>
                ) : messagesError ? (
                  <div className="flex items-center justify-center h-full">
                    <p className={`text-sm ${isDark ? "text-white/40" : "text-neutral-400"}`}>{messagesError}</p>
                  </div>
                ) : uiMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDark ? "bg-white/5" : "bg-neutral-100"}`}>
                      <MessageSquare size={24} className="text-[#e2593b] opacity-60" />
                    </div>
                    <p className={`text-sm font-medium ${isDark ? "text-white/60" : "text-neutral-500"}`}>
                      Start the conversation
                    </p>
                    <p className={`text-xs text-center max-w-xs ${isDark ? "text-white/30" : "text-neutral-400"}`}>
                      Say hi and kick off your skill exchange!
                    </p>
                  </div>
                ) : (
                  <>
                    {uiMessages.map((msg, i) => {
                      const isMe = msg.sender === "me";
                      const prevMsg = uiMessages[i - 1];
                      const isSameGroup = prevMsg?.sender === msg.sender;

                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 8, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ duration: 0.15 }}
                          className={`flex ${isMe ? "justify-end" : "justify-start"} ${isSameGroup ? "mt-0.5" : "mt-3"}`}
                        >
                          {/* Avatar for peer (only on first of group) */}
                          {!isMe && !isSameGroup && selectedPeer && (
                            <div className="mr-2 mt-auto shrink-0">
                              <UserAvatar user={selectedPeer} size="xs" />
                            </div>
                          )}
                          {!isMe && isSameGroup && <div className="w-7 mr-2 shrink-0" />}

                          <div className={`max-w-[70%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                            <div
                              className={`
                                px-4 py-2.5 text-sm leading-relaxed break-words
                                ${!isSameGroup ? (isMe ? "rounded-2xl rounded-br-md" : "rounded-2xl rounded-bl-md") : (isMe ? "rounded-2xl rounded-tr-md rounded-br-md" : "rounded-2xl rounded-tl-md rounded-bl-md")}
                                ${isMe
                                  ? "bg-[#e2593b] text-white"
                                  : isDark
                                    ? "bg-white/10 text-white"
                                    : "bg-white text-neutral-900 shadow-sm border border-neutral-100"
                                }
                                ${msg.isDeleted ? "italic opacity-50" : ""}
                              `}
                            >
                              {msg.text}
                            </div>
                            {/* Timestamp — only on last of group or if no next sibling */}
                            {(!uiMessages[i + 1] || uiMessages[i + 1]?.sender !== msg.sender) && msg.time && (
                              <span className={`text-[10px] mt-1 px-1 ${isDark ? "text-white/25" : "text-neutral-400"}`}>
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
              <div className={`px-4 py-3 border-t ${isDark ? "bg-[#111111] border-white/[0.07]" : "bg-white border-neutral-200"}`}>
                {sendError && (
                  <p className="text-xs text-red-500 mb-2 px-1">{sendError}</p>
                )}
                <div className={`flex items-end gap-2 p-1.5 rounded-2xl border ${isDark ? "bg-white/5 border-white/10" : "bg-neutral-50 border-neutral-200"}`}>
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
                    placeholder="Type a message…"
                    className={`
                      flex-1 resize-none px-3 py-2 text-sm outline-none bg-transparent
                      max-h-[120px] leading-relaxed
                      ${isDark ? "text-white placeholder:text-white/30 caret-white" : "text-black placeholder:text-neutral-400 caret-black"}
                    `}
                    style={{ overflowY: "auto" }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!messageInput.trim() || sending}
                    className={`
                      shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all
                      ${messageInput.trim() && !sending
                        ? "bg-[#e2593b] text-white hover:bg-[#cc4e33] shadow-md"
                        : isDark
                          ? "bg-white/10 text-white/30"
                          : "bg-neutral-200 text-neutral-400"
                      }
                    `}
                  >
                    {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  </button>
                </div>
                <p className={`text-[10px] text-center mt-1.5 ${isDark ? "text-white/15" : "text-neutral-300"}`}>
                  Enter to send · Shift+Enter for new line
                </p>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}