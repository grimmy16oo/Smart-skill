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
    availability: doc.availability || { recurring: [], timezone: "Asia/Dhaka" },
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

function serializePublicUser(user) {
  if (!user) return null;
  const doc = typeof user.toObject === "function" ? user.toObject() : user;
  const id = toId(doc);

  return {
    id,
    uid: id,
    name: doc.name,
    avatar: doc.avatar,
    location: doc.location || "",
    skillsOffered: doc.skillsOffered || [],
    skillsWanted: doc.skillsWanted || [],
  };
}

export function serializeSwapRequest(request, currentUserId) {
  if (!request) return null;

  const doc = typeof request.toObject === "function" ? request.toObject() : request;
  const requester = serializePublicUser(doc.requester);
  const recipient = serializePublicUser(doc.recipient);
  const currentId = currentUserId?.toString();
  const requesterId = requester?.uid || toId(doc.requester);
  const recipientId = recipient?.uid || toId(doc.recipient);

  return {
    id: toId(doc),
    requesterId,
    recipientId,
    requester,
    recipient,
    peer: currentId === requesterId ? recipient : requester,
    direction: currentId === requesterId ? "outgoing" : "incoming",
    matchId: toId(doc.match),
    offeredSkill: doc.offeredSkill || "",
    wantedSkill: doc.wantedSkill || "",
    message: doc.message || "",
    status: doc.status || "pending",
    timeline: doc.timeline || [],
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
