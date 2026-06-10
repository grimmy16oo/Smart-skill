export function hasRealAvatar(avatar) {
  return Boolean(avatar && !avatar.includes("dicebear.com"));
}

export function getUserInitials(user) {
  const name = user?.name || user?.displayName || user?.email || "User";
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}
