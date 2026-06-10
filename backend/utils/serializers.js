function toId(value) {
  if (!value) return "";
  if (value._id) return value._id.toString();
  return value.toString();
}

export function serializeUser(user) {
  if (!user) return null;

  const doc = typeof user.toObject === "function" ? user.toObject() : user;
  const id = toId(doc);

  return {
    id,
    uid: id,
    name: doc.name,
    email: doc.email,
    avatar: doc.avatar,
    bio: doc.bio || "",
    location: doc.location || "",
    skillsOffered: doc.skillsOffered || [],
    skillsWanted: doc.skillsWanted || [],
    rating: doc.rating || 0,
    reviewCount: doc.reviewCount || 0,
    matchCount: doc.matchCount || 0,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function serializeMatch(match) {
  if (!match) return null;

  const doc = typeof match.toObject === "function" ? match.toObject() : match;
  const lastMessageAt = doc.lastMessageAt || null;

  return {
    id: toId(doc),
    users: (doc.users || []).map(toId),
    matchPercent: doc.matchPercent || 0,
    status: doc.status || "matched",
    lastMessage: doc.lastMessageText
      ? {
          text: doc.lastMessageText,
          senderId: toId(doc.lastMessageSender),
          timestamp: lastMessageAt,
        }
      : null,
    createdAt: doc.createdAt,
    updatedAt: lastMessageAt || doc.updatedAt,
  };
}

export function serializeMessage(message) {
  if (!message) return null;

  const doc = typeof message.toObject === "function" ? message.toObject() : message;
  const createdAt = doc.createdAt || doc.timestamp;

  return {
    id: toId(doc),
    matchId: toId(doc.match || doc.matchId),
    senderId: toId(doc.sender || doc.senderId),
    text: doc.text,
    read: Boolean(doc.read),
    timestamp: createdAt,
    createdAt,
    updatedAt: doc.updatedAt,
  };
}
