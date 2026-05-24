import { apiRequest, normalizeUser } from "./api";

export function buildAvatarUrl() {
  return "";
}

export async function createUserProfile(uid, profile) {
  const data = await apiRequest("/auth/profile", {
    method: "PUT",
    body: JSON.stringify(profile),
  });

  return normalizeUser(data.user || { uid, ...profile });
}

export async function getUserProfile(uid) {
  if (!uid) return null;

  const data = await apiRequest(`/users/${uid}`);
  return normalizeUser(data.user);
}

export async function ensureUserProfile(user) {
  if (!user?.uid) return null;
  return getUserProfile(user.uid);
}

export async function updateUserProfile(uid, updates) {
  const data = await apiRequest("/auth/profile", {
    method: "PUT",
    body: JSON.stringify(updates),
  });

  return normalizeUser(data.user || { uid, ...updates });
}

export async function uploadAvatar(file) {
  const formData = new FormData();
  formData.append("avatar", file);

  const data = await apiRequest("/uploads/avatar", {
    method: "POST",
    body: formData,
  });

  return normalizeUser(data.user);
}

export function computeMatchPercent(currentProfile, otherProfile) {
  if (!currentProfile || !otherProfile) return 50;

  const offered = new Set(currentProfile.skillsOffered || []);
  const wanted = new Set(currentProfile.skillsWanted || []);
  const theirOffered = otherProfile.skillsOffered || [];
  const theirWanted = otherProfile.skillsWanted || [];

  let overlap = 0;
  theirOffered.forEach((skill) => {
    if (wanted.has(skill)) overlap += 1;
  });
  theirWanted.forEach((skill) => {
    if (offered.has(skill)) overlap += 1;
  });

  const total = Math.max(theirOffered.length + theirWanted.length, 1);
  return Math.min(99, Math.max(40, Math.round((overlap / total) * 100)));
}

export function mapUserForSwipe(userData, currentProfile) {
  const profile = normalizeUser(userData);

  return {
    ...profile,
    matchPercent: userData.matchPercent || computeMatchPercent(currentProfile, profile),
  };
}

export async function getUsersForSwipe(currentUid, currentProfile) {
  const data = await apiRequest("/users/swipe");

  return {
    users: (data.users || []).map((user) => mapUserForSwipe(user, currentProfile)),
    totalInDatabase: data.totalInDatabase || 0,
    otherUsersCount: data.otherUsersCount || 0,
    hiddenCount: data.hiddenCount || 0,
    behaviorSignals: data.behaviorSignals || 0,
  };
}

export async function getFeaturedUsers(count = 3) {
  const data = await apiRequest(`/users/featured?limit=${count}`);
  return (data.users || []).map((user) => ({
    ...normalizeUser(user),
    matchPercent: user.matchPercent || 85,
    rating: user.rating || 4.8,
  }));
}
