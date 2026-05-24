import { apiRequest } from "./api";
import { getUserProfile } from "./userService";

function getTimestampMs(timestamp) {
  if (!timestamp) return 0;
  if (typeof timestamp.toMillis === "function") return timestamp.toMillis();
  if (typeof timestamp.toDate === "function") return timestamp.toDate().getTime();

  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function sortMessagesByTimestamp(messages) {
  return [...messages].sort((a, b) => getTimestampMs(a.timestamp) - getTimestampMs(b.timestamp));
}

export async function ensureChatForMatch(matchId) {
  if (!matchId) throw new Error("Match id is required");

  const data = await apiRequest(`/messages/${matchId}/ensure`, {
    method: "POST",
  });

  return data.matchId || matchId;
}

export async function sendMessage(matchId, senderId, text) {
  const trimmed = text?.trim();
  if (!matchId || !senderId || !trimmed) {
    throw new Error("Message, match, and sender are required");
  }

  const data = await apiRequest(`/messages/${matchId}`, {
    method: "POST",
    body: JSON.stringify({ text: trimmed }),
  });

  return data.message;
}

export async function fetchMatchMessages(matchId) {
  if (!matchId) return [];

  const data = await apiRequest(`/messages/${matchId}`);
  return sortMessagesByTimestamp(data.messages || []);
}

export function normalizeSocketMessage(raw) {
  return {
    id: raw.id,
    senderId: raw.senderId,
    text: raw.text,
    timestamp: raw.timestamp,
  };
}

export function mergeMessages(existing, incoming) {
  const byId = new Map(existing.map((m) => [m.id, m]));
  incoming.forEach((m) => byId.set(m.id, m));
  return sortMessagesByTimestamp([...byId.values()]);
}

export { getUserProfile };

export function getDefaultUserProfile(uid) {
  return {
    id: uid,
    uid,
    name: `User ${uid.slice(0, 6)}`,
    avatar: "",
    online: false,
    unread: 0,
  };
}

export function formatMessageTime(timestamp) {
  if (!timestamp) return "";

  const date =
    typeof timestamp.toDate === "function"
      ? timestamp.toDate()
      : new Date(timestamp);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatRelativeTime(timestamp) {
  if (!timestamp) return "";

  const date =
    typeof timestamp.toDate === "function"
      ? timestamp.toDate()
      : new Date(timestamp);

  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
