// ChatPage - real-time messaging per match
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Send, Search, Circle, ArrowLeft, LogIn, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
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
import { getPeerUidFromMatch, subscribeToMatches } from "../services/matchService";
import {
  connectSocket,
  disconnectSocket,
  emitChatMessage,
  joinMatchRoom,
  leaveMatchRoom,
  onChatError,
  onNewMessage,
} from "../services/socketService";
import UserAvatar from "../components/UserAvatar";

const LOADING_TIMEOUT_MS = 8000;

export default function ChatPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
  const currentUid = user?.uid ?? null;

  useEffect(() => {
    if (user?.uid) {
      connectSocket();
    }
    return () => disconnectSocket();
  }, [user?.uid]);

  const loadPeerProfile = useCallback(async (peerUid) => {
    if (!peerUid) return;

    const userProfile = await getUserProfile(peerUid);
    setPeerProfiles((prev) => {
      if (prev[peerUid]) return prev;
      return {
        ...prev,
        [peerUid]: userProfile
          ? {
              id: peerUid,
              name: userProfile.name || `User ${peerUid.slice(0, 6)}`,
              avatar: userProfile.avatar || getDefaultUserProfile(peerUid).avatar,
              online: false,
              unread: 0,
            }
          : getDefaultUserProfile(peerUid),
      };
    });
  }, []);

  useEffect(() => {
    if (!currentUid) {
      setMatches([]);
      setMatchesLoading(false);
      return;
    }

    let snapshotReceived = false;
    setMatchesLoading(true);
    setMatchesError(null);

    const timeoutId = window.setTimeout(() => {
      if (!snapshotReceived) {
        setMatchesLoading(false);
        setMatchesError(
          "Could not load matches. Check that the backend and MongoDB are running."
        );
      }
    }, LOADING_TIMEOUT_MS);

    const unsubscribe = subscribeToMatches(
      currentUid,
      (nextMatches) => {
        snapshotReceived = true;
        setMatches(nextMatches);
        setMatchesLoading(false);
        setMatchesError(null);
      },
      (error) => {
        snapshotReceived = true;
        setMatchesError(
          error.code === "permission-denied"
            ? "Permission denied loading matches."
            : error.message || "Failed to load matches"
        );
        setMatchesLoading(false);
      }
    );

    return () => {
      window.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [currentUid]);

  useEffect(() => {
    if (!currentUid) return;

    matches.forEach((match) => {
      const peerUid = getPeerUidFromMatch(match.users, currentUid);
      if (peerUid) loadPeerProfile(peerUid);
    });
  }, [matches, currentUid, loadPeerProfile]);

  useEffect(() => {
    if (!currentUid || matchesLoading) return;

    if (matchFromUrl) {
      setSelectedMatchId((prev) => (prev === matchFromUrl ? prev : matchFromUrl));
      return;
    }

    if (selectedMatchId) return;

    if (matches.length > 0) {
      setSelectedMatchId(matches[0].id);
    }
  }, [matches, currentUid, matchFromUrl, selectedMatchId, matchesLoading]);

  useEffect(() => {
    if (!selectedMatchId || !currentUid) {
      setMessages([]);
      setMessagesLoading(false);
      setMessagesError(null);
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
      } catch (error) {
        if (!cancelled) {
          setMessagesError(error.message || "Failed to load messages");
          setMessagesLoading(false);
        }
      }
    })();

    joinMatchRoom(selectedMatchId, currentUid);

    const offMessage = onNewMessage((raw) => {
      if (raw.matchId !== selectedMatchId) return;
      setMessages((prev) =>
        mergeMessages(prev, [normalizeSocketMessage(raw)])
      );
    });

    const offError = onChatError((err) => {
      setSendError(err.message || "Chat connection error");
    });

    return () => {
      cancelled = true;
      leaveMatchRoom(selectedMatchId);
      offMessage();
      offError();
    };
  }, [selectedMatchId, currentUid]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selectedMatchId, messagesLoading]);

  const conversationList = useMemo(() => {
    if (!currentUid) return [];

    return matches
      .map((match) => {
        const peerUid = getPeerUidFromMatch(match.users, currentUid);
        if (!peerUid) return null;

        const peer = peerProfiles[peerUid] || getDefaultUserProfile(peerUid);
        const chatMessages = match.id === selectedMatchId ? messages : [];
        const lastMsg = chatMessages[chatMessages.length - 1];

        return {
          matchId: match.id,
          peerId: peerUid,
          name: peer.name,
          avatar: peer.avatar,
          online: peer.online,
          unread: peer.unread,
          lastMessage: lastMsg?.text || "No messages yet",
          lastTime: lastMsg?.timestamp ? formatRelativeTime(lastMsg.timestamp) : "",
        };
      })
      .filter(Boolean);
  }, [matches, currentUid, peerProfiles, selectedMatchId, messages]);

  const filteredConversations = conversationList.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedPeerUid = useMemo(() => {
    if (!selectedMatchId || !currentUid) return null;
    const match = matches.find((m) => m.id === selectedMatchId);
    return match ? getPeerUidFromMatch(match.users, currentUid) : null;
  }, [selectedMatchId, matches, currentUid]);

  const selectedUser = selectedPeerUid
    ? peerProfiles[selectedPeerUid] || getDefaultUserProfile(selectedPeerUid)
    : null;

  const uiMessages = useMemo(
    () =>
      messages.map((msg) => ({
        id: msg.id,
        sender: msg.senderId === currentUid ? "me" : "them",
        text: msg.text,
        time: formatMessageTime(msg.timestamp),
      })),
    [messages, currentUid]
  );

  const handleSend = async () => {
    const text = messageInput.trim();
    if (!text || !currentUid || !selectedMatchId || sending) return;

    setSendError(null);
    setSending(true);

    try {
      const saved = await sendMessage(selectedMatchId, currentUid, text);
      emitChatMessage({
        id: saved.id,
        matchId: selectedMatchId,
        senderId: currentUid,
        text: saved.text,
        timestamp: saved.timestamp,
      });
      setMessages((prev) => mergeMessages(prev, [saved]));
      setMessageInput("");
    } catch (error) {
      console.error("Send message error:", error);
      setSendError(error.message || "Failed to send message");
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
    setShowSidebar(false);
    setSendError(null);
  };

  if (authLoading) {
    return (
      <div className="h-[calc(100vh-65px)] flex items-center justify-center bg-base-200/30">
        <Loader2 className="animate-spin text-primary" size={36} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-[calc(100vh-65px)] flex items-center justify-center bg-base-200/30 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-base-100 p-8 rounded-3xl shadow-xl text-center max-w-md w-full"
        >
          <h1 className="text-2xl font-display font-bold mb-2">Sign in to chat</h1>
          <p className="text-base-content/60 mb-6">
            Log in to send and receive real-time messages with your matches.
          </p>
          <button
            onClick={() => navigate("/login")}
            className="btn btn-vibrant-primary w-full flex items-center gap-2 justify-center"
          >
            <LogIn size={18} />
            Go to Login
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-65px)] flex bg-base-200/30">
      <aside
        className={`
          ${showSidebar ? "flex" : "hidden"} lg:flex
          flex-col w-full lg:w-80 xl:w-96
          bg-base-100 border-r border-base-300 shrink-0
        `}
      >
        <div className="p-5 border-b border-base-300">
          <h2 className="text-2xl font-display font-bold mb-4">Messages</h2>
          <label className="input input-bordered rounded-2xl flex items-center gap-2 bg-base-200/60">
            <Search size={16} className="text-base-content/40" />
            <input
              type="text"
              placeholder="Search matches..."
              className="grow text-sm bg-transparent outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>
          {matchesError && (
            <p className="text-xs text-error mt-2">{matchesError}</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {matchesLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-primary" size={28} />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center text-sm text-base-content/40 py-8 px-4">
              <p>No matches yet.</p>
              <Link to="/swipe" className="link link-primary text-xs mt-2 inline-block">
                Find people to match with
              </Link>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <button
                key={conv.matchId}
                onClick={() => handleSelectMatch(conv.matchId)}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-200 text-left ${
                  selectedMatchId === conv.matchId
                    ? "bg-primary/10 border border-primary/20"
                    : "hover:bg-base-200"
                }`}
              >
                <div className="relative shrink-0">
                  <UserAvatar user={conv} size="lg" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm truncate">{conv.name}</span>
                    {conv.lastTime && (
                      <span className="text-[11px] text-base-content/40 shrink-0 ml-1">
                        {conv.lastTime}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-base-content/50 truncate mt-0.5">
                    {conv.lastMessage}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      <main
        className={`
          ${!showSidebar ? "flex" : "hidden"} lg:flex
          flex-col flex-1 bg-base-100 min-w-0
        `}
      >
        {selectedUser && selectedMatchId ? (
          <>
            <div className="flex items-center gap-3 p-4 border-b border-base-300 bg-base-100/80 backdrop-blur-sm">
              <button
                className="btn btn-icon-vibrant btn-sm bg-slate-400 hover:bg-slate-500 text-white lg:hidden"
                onClick={() => setShowSidebar(true)}
              >
                <ArrowLeft size={18} />
              </button>

              <div className="relative">
                <UserAvatar user={selectedUser} size="md" className="ring-primary/20" />
              </div>

              <div className="flex-1">
                <h3 className="font-semibold text-sm">{selectedUser.name}</h3>
                <p className="text-xs text-base-content/40 flex items-center gap-1">
                  <Circle size={8} className="fill-success text-success" /> Live chat
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messagesLoading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="animate-spin text-primary" size={32} />
                </div>
              ) : messagesError ? (
                <p className="text-center text-sm text-error py-8">{messagesError}</p>
              ) : uiMessages.length === 0 ? (
                <p className="text-center text-sm text-base-content/40 py-8">
                  No messages yet. Say hello!
                </p>
              ) : (
                uiMessages.map((msg, i) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.3) }}
                    className={`flex ${msg.sender === "me" ? "justify-end" : "justify-start"} items-end gap-2`}
                  >
                    {msg.sender !== "me" && (
                      <UserAvatar user={selectedUser} size="xs" className="mb-1" />
                    )}

                    <div
                      className={`max-w-[70%] ${msg.sender === "me" ? "items-end" : "items-start"} flex flex-col gap-1`}
                    >
                      <div
                        className={`px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                          msg.sender === "me"
                            ? "chat-bubble-sent"
                            : "bg-base-200 text-base-content chat-bubble-received"
                        }`}
                      >
                        {msg.text}
                      </div>
                      <span className="text-[10px] text-base-content/30 px-1">
                        {msg.time}
                      </span>
                    </div>
                  </motion.div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-base-300 bg-base-100">
              {sendError && (
                <p className="text-xs text-error text-center mb-2">{sendError}</p>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={`Message ${selectedUser.name}...`}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={sending}
                  className="input input-bordered flex-1 rounded-2xl bg-base-200/60 focus:bg-base-100 text-sm transition-colors"
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSend}
                  disabled={!messageInput.trim() || sending}
                  className="btn btn-vibrant-primary btn-circle font-semibold disabled:opacity-40"
                >
                  {sending ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Send size={18} />
                  )}
                </motion.button>
              </div>
              <p className="text-xs text-base-content/30 text-center mt-2">
                Press Enter to send
              </p>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-base-content/30">
            <div className="text-6xl mb-4">💬</div>
            <p className="font-medium">Select a conversation</p>
            {!matchesLoading && conversationList.length === 0 && (
              <Link to="/swipe" className="btn btn-vibrant-primary btn-sm mt-4">
                Go to Discover
              </Link>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
