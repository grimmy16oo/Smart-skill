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
                online: false,
                unread: 0,
              }
            : getDefaultUserProfile(peerUid),
        };
      });
    } catch {
      setPeerProfiles((prev) => {
        if (prev[peerUid]) return prev;
        return {
          ...prev,
          [peerUid]: getDefaultUserProfile(peerUid),
        };
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
        setMatchesError("Could not load matches. Check backend + MongoDB.");
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

      setMessages((prev) =>
        mergeMessages(prev, [normalizeSocketMessage(raw)])
      );
    });

    const offError = onChatError((err) => {
      setSendError(err.message);
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
    if (!text || sending) return;

    setSending(true);
    try {
      const saved = await sendMessage(selectedMatchId, currentUid, text);
      setMessages((prev) => mergeMessages(prev, [saved]));
      setMessageInput("");
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
      <div className="h-full flex items-center justify-center">
        <button onClick={() => navigate("/login")} className="btn text-black">
          <LogIn size={16} /> Login
        </button>
      </div>
    );
  }

  return (
    <div
      className={`w-full h-full overflow-hidden ${
        isDark ? "bg-[#0b0b0b] text-white" : "bg-[#f8f8f8] text-black"
      }`}
    >
      <div className="flex h-full">

        {/* SIDEBAR */}
        <aside
          className={`${
            showSidebar ? "flex" : "hidden"
          } lg:flex flex-col w-full sm:w-[320px] border-r ${
            isDark ? "border-white/10 bg-[#0b0b0b]" : "border-neutral-200 bg-white"
          }`}
        >
          <div className="p-4 border-b border-neutral-200 dark:border-white/10">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border bg-white text-black dark:bg-white/5 dark:text-white">
              <Search size={14} />
              <input
                className={`flex-1 outline-none bg-transparent ${
                  isDark
                    ? "text-white placeholder:text-white/40"
                    : "text-black placeholder:text-neutral-500"
                }`}
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2" />
        </aside>

        {/* MAIN */}
        <main className="flex-1 flex flex-col min-w-0">

          {/* MESSAGES */}
          <div className="flex-1 overflow-y-auto p-4">
            {uiMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === "me" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`px-4 py-2 rounded-2xl max-w-[80%] text-sm ${
                    msg.sender === "me"
                      ? "bg-[#e2593b] text-white"
                      : isDark
                      ? "bg-white/10 text-white"
                      : "bg-neutral-200 text-black"
                  }`}
                >
                  <p className="break-words">{msg.text}</p>
                  <span className="text-[10px] opacity-60 block mt-1">
                    {msg.time}
                  </span>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* INPUT */}
          <div
            className={`p-4 border-t ${
              isDark ? "border-white/10 bg-[#0b0b0b]" : "border-neutral-200 bg-white"
            }`}
          >
            <div className="flex gap-2">
              <input
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type message..."
                className={`flex-1 px-4 py-3 rounded-xl outline-none border ${
                  isDark
                    ? "bg-white/5 text-white placeholder:text-white/40 caret-white border-white/10"
                    : "bg-white text-black placeholder:text-neutral-500 caret-black border-neutral-300"
                }`}
              />

              <button
                onClick={handleSend}
                disabled={!messageInput.trim() || sending}
                className="w-12 h-12 bg-[#e2593b] text-white rounded-xl flex items-center justify-center disabled:opacity-50"
              >
                {sending ? <Loader2 className="animate-spin" /> : <Send />}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}