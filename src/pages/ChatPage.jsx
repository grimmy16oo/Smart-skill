// ChatPage - responsive realtime messaging layout
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";

import {
  Send,
  Search,
  Circle,
  ArrowLeft,
  LogIn,
  Loader2,
  Sparkles,
  MessageSquare,
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
  const { isDark } = useTheme();

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

  /* SOCKET */

  useEffect(() => {
    if (user?.uid) {
      connectSocket();
    }

    return () => disconnectSocket();
  }, [user?.uid]);

  /* LOAD PEERS */

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
              avatar:
                userProfile.avatar ||
                getDefaultUserProfile(peerUid).avatar,
              online: false,
              unread: 0,
            }
          : getDefaultUserProfile(peerUid),
      };
    });
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

    const timeoutId = window.setTimeout(() => {
      if (!snapshotReceived) {
        setMatchesLoading(false);

        setMatchesError(
          "Could not load matches. Check backend + MongoDB."
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

  /* LOAD PEER DATA */

  useEffect(() => {
    if (!currentUid) return;

    matches.forEach((match) => {
      const peerUid = getPeerUidFromMatch(
        match.users,
        currentUid
      );

      if (peerUid) {
        loadPeerProfile(peerUid);
      }
    });
  }, [matches, currentUid, loadPeerProfile]);

  /* SELECT MATCH */

  useEffect(() => {
    if (!currentUid || matchesLoading) return;

    if (matchFromUrl) {
      setSelectedMatchId((prev) =>
        prev === matchFromUrl ? prev : matchFromUrl
      );

      return;
    }

    if (selectedMatchId) return;

    if (matches.length > 0) {
      setSelectedMatchId(matches[0].id);
    }
  }, [
    matches,
    currentUid,
    matchFromUrl,
    selectedMatchId,
    matchesLoading,
  ]);

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

        const history =
          await fetchMatchMessages(selectedMatchId);

        if (!cancelled) {
          setMessages(history);
          setMessagesLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          setMessagesError(
            error.message || "Failed to load messages"
          );

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
      setSendError(err.message || "Chat error");
    });

    return () => {
      cancelled = true;

      leaveMatchRoom(selectedMatchId);

      offMessage();
      offError();
    };
  }, [selectedMatchId, currentUid]);

  /* AUTO SCROLL */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  /* CONVERSATIONS */

  const conversationList = useMemo(() => {
    if (!currentUid) return [];

    return matches
      .map((match) => {
        const peerUid = getPeerUidFromMatch(
          match.users,
          currentUid
        );

        if (!peerUid) return null;

        const peer =
          peerProfiles[peerUid] ||
          getDefaultUserProfile(peerUid);

        const chatMessages =
          match.id === selectedMatchId ? messages : [];

        const lastMsg =
          chatMessages[chatMessages.length - 1];

        return {
          matchId: match.id,
          peerId: peerUid,
          name: peer.name,
          avatar: peer.avatar,
          online: peer.online,
          unread: peer.unread,
          lastMessage:
            lastMsg?.text || "No messages yet",
          lastTime: lastMsg?.timestamp
            ? formatRelativeTime(lastMsg.timestamp)
            : "",
        };
      })
      .filter(Boolean);
  }, [
    matches,
    currentUid,
    peerProfiles,
    selectedMatchId,
    messages,
  ]);

  const filteredConversations =
    conversationList.filter((c) =>
      c.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
    );

  const selectedPeerUid = useMemo(() => {
    if (!selectedMatchId || !currentUid) return null;

    const match = matches.find(
      (m) => m.id === selectedMatchId
    );

    return match
      ? getPeerUidFromMatch(match.users, currentUid)
      : null;
  }, [selectedMatchId, matches, currentUid]);

  const selectedUser = selectedPeerUid
    ? peerProfiles[selectedPeerUid] ||
      getDefaultUserProfile(selectedPeerUid)
    : null;

  const uiMessages = useMemo(
    () =>
      messages.map((msg) => ({
        id: msg.id,
        sender:
          msg.senderId === currentUid
            ? "me"
            : "them",
        text: msg.text,
        time: formatMessageTime(msg.timestamp),
      })),
    [messages, currentUid]
  );

  /* SEND */

  const handleSend = async () => {
    const text = messageInput.trim();

    if (
      !text ||
      !currentUid ||
      !selectedMatchId ||
      sending
    )
      return;

    setSendError(null);
    setSending(true);

    try {
      const saved = await sendMessage(
        selectedMatchId,
        currentUid,
        text
      );

      emitChatMessage({
        id: saved.id,
        matchId: selectedMatchId,
        senderId: currentUid,
        text: saved.text,
        timestamp: saved.timestamp,
      });

      setMessages((prev) =>
        mergeMessages(prev, [saved])
      );

      setMessageInput("");
    } catch (error) {
      setSendError(
        error.message || "Failed to send"
      );
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

    if (window.innerWidth < 1024) {
      setShowSidebar(false);
    }
  };

  /* LOADING */

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2
          className="animate-spin text-[#e2593b]"
          size={36}
        />
      </div>
    );
  }

  /* NO USER */

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <button
            onClick={() => navigate("/login")}
            className="btn"
          >
            <LogIn size={16} />
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`
        w-full
        h-screen
        overflow-hidden
        ${
          isDark
            ? "bg-[#0b0b0b] text-white"
            : "bg-[#fcfcfc] text-black"
        }
      `}
    >
      <div className="flex h-full overflow-hidden">

        {/* SIDEBAR */}

        <aside
          className={`
            ${
              showSidebar
                ? "flex"
                : "hidden"
            }

            lg:flex
            flex-col

            absolute lg:relative
            inset-y-0 left-0

            z-40

            w-full
            sm:w-[320px]
            lg:w-[340px]

            shrink-0

            border-r

            ${
              isDark
                ? "border-white/[0.06] bg-[#0b0b0b]"
                : "border-neutral-200 bg-white"
            }
          `}
        >
          {/* SIDEBAR HEADER */}

          <div
            className={`
              p-4
              border-b
              ${
                isDark
                  ? "border-white/[0.06]"
                  : "border-neutral-200"
              }
            `}
          >
            <h2 className="text-sm font-black uppercase tracking-widest text-[#e2593b] mb-4">
              Messages
            </h2>

            <div
              className={`
                flex items-center gap-2
                px-3 py-2 rounded-xl border
                ${
                  isDark
                    ? "border-white/[0.06] bg-white/[0.03]"
                    : "border-neutral-200 bg-neutral-50"
                }
              `}
            >
              <Search size={14} />

              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) =>
                  setSearchQuery(e.target.value)
                }
                className="bg-transparent outline-none flex-1 text-sm"
              />
            </div>
          </div>

          {/* CONVERSATIONS */}

          <div className="flex-1 overflow-y-auto p-2 space-y-2">

            {filteredConversations.map((conv) => {
              const active =
                selectedMatchId === conv.matchId;

              return (
                <button
                  key={conv.matchId}
                  onClick={() =>
                    handleSelectMatch(conv.matchId)
                  }
                  className={`
                    w-full
                    flex items-center gap-3
                    p-3 rounded-2xl
                    transition-all

                    ${
                      active
                        ? "bg-[#e2593b] text-white"
                        : isDark
                        ? "hover:bg-white/[0.04]"
                        : "hover:bg-neutral-100"
                    }
                  `}
                >
                  <UserAvatar
                    user={conv}
                    size="lg"
                    className="rounded-xl"
                  />

                  <div className="flex-1 text-left min-w-0">
                    <div className="flex justify-between">
                      <h3 className="font-semibold truncate text-sm">
                        {conv.name}
                      </h3>

                      <span className="text-[10px] opacity-60">
                        {conv.lastTime}
                      </span>
                    </div>

                    <p className="truncate text-xs opacity-70">
                      {conv.lastMessage}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* MAIN */}

        <main className="flex flex-col flex-1 min-w-0 overflow-hidden">

          {selectedUser ? (
            <>
              {/* CHAT HEADER */}

              <div
                className={`
                  sticky top-0 z-20
                  flex items-center gap-3
                  px-4 py-3
                  border-b backdrop-blur-xl
                  ${
                    isDark
                      ? "border-white/[0.06] bg-[#0b0b0b]/80"
                      : "border-neutral-200 bg-white/80"
                  }
                `}
              >
                <button
                  onClick={() =>
                    setShowSidebar(true)
                  }
                  className="lg:hidden"
                >
                  <ArrowLeft size={18} />
                </button>

                <UserAvatar
                  user={selectedUser}
                  size="md"
                  className="rounded-xl"
                />

                <div>
                  <h3 className="font-bold text-sm">
                    {selectedUser.name}
                  </h3>

                  <p className="text-xs opacity-60 flex items-center gap-1">
                    <Circle
                      size={6}
                      className="fill-green-500 text-green-500"
                    />
                    Online
                  </p>
                </div>
              </div>

              {/* MESSAGES */}

              <div className="flex-1 overflow-y-auto p-4 space-y-4">

                {uiMessages.map((msg, i) => {
                  const isMe =
                    msg.sender === "me";

                  return (
                    <motion.div
                      key={msg.id}
                      initial={{
                        opacity: 0,
                        y: 10,
                        scale: 0.98,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        scale: 1,
                      }}
                      transition={{
                        delay: Math.min(
                          i * 0.02,
                          0.2
                        ),
                      }}
                      className={`flex ${
                        isMe
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`
                          max-w-[92%]
                          sm:max-w-[75%]
                          px-4 py-3
                          rounded-2xl
                          text-sm
                          leading-relaxed

                          ${
                            isMe
                              ? "bg-[#e2593b] text-white rounded-br-md"
                              : isDark
                              ? "bg-white/[0.05] border border-white/[0.06]"
                              : "bg-neutral-100 border border-neutral-200"
                          }
                        `}
                      >
                        <p>{msg.text}</p>

                        <span className="block mt-1 text-[10px] opacity-50">
                          {msg.time}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}

                <div ref={messagesEndRef} />
              </div>

              {/* INPUT */}

              <div
                className={`
                  sticky bottom-0
                  p-4 border-t
                  ${
                    isDark
                      ? "border-white/[0.06] bg-[#0b0b0b]"
                      : "border-neutral-200 bg-white"
                  }
                `}
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) =>
                      setMessageInput(e.target.value)
                    }
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    className={`
                      flex-1
                      px-4 py-3
                      rounded-xl
                      outline-none border
                      text-sm

                      ${
                        isDark
                          ? "bg-white/[0.03] border-white/[0.06]"
                          : "bg-neutral-50 border-neutral-200"
                      }
                    `}
                  />

                  <motion.button
                    whileHover={{
                      scale: 1.03,
                    }}
                    whileTap={{
                      scale: 0.97,
                    }}
                    onClick={handleSend}
                    className="w-12 h-12 rounded-xl bg-[#e2593b] text-white flex items-center justify-center"
                  >
                    {sending ? (
                      <Loader2
                        className="animate-spin"
                        size={18}
                      />
                    ) : (
                      <Send size={18} />
                    )}
                  </motion.button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare
                  size={40}
                  className="mx-auto mb-4 opacity-40"
                />

                <h3 className="font-bold text-lg">
                  Select a chat
                </h3>

                <p className="text-sm opacity-60 mt-1">
                  Start messaging your matches
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}