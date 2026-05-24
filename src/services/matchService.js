import { apiRequest } from "./api";

export function getLikeDocId(fromUid, toUid) {
  return `${fromUid}_${toUid}`;
}

export function getMatchId(uid1, uid2) {
  if (!uid1 || !uid2) return null;
  return [uid1, uid2].sort().join("_");
}

export function getPeerUidFromMatch(matchUsers, currentUid) {
  if (!Array.isArray(matchUsers) || !currentUid) return null;
  return matchUsers.find((uid) => uid !== currentUid) ?? null;
}

export async function recordSwipeLike(currentUid, targetUid) {
  const data = await apiRequest(`/matches/like/${targetUid}`, {
    method: "POST",
  });

  return data.match || null;
}

export async function recordSwipeSkip(targetUid) {
  await apiRequest(`/matches/skip/${targetUid}`, {
    method: "POST",
  });
}

export async function undoSwipeLike(targetUid) {
  await apiRequest(`/matches/like/${targetUid}`, {
    method: "DELETE",
  });
}

export async function undoSwipeSkip(targetUid) {
  await apiRequest(`/matches/skip/${targetUid}`, {
    method: "DELETE",
  });
}

export async function createMatch(uid1, uid2) {
  const targetUid = uid1 === uid2 ? null : uid2;
  if (!targetUid) throw new Error("Invalid match participants");

  const data = await apiRequest(`/matches/${targetUid}`, {
    method: "POST",
  });

  return data.match;
}

export async function fetchMatches() {
  const data = await apiRequest("/matches");
  return data.matches || [];
}

export function subscribeToMatches(currentUid, onData, onError) {
  if (!currentUid) {
    onData([]);
    return () => {};
  }

  let cancelled = false;
  let timeoutId = null;

  const load = async () => {
    try {
      const matches = await fetchMatches();
      if (!cancelled) onData(matches);
    } catch (error) {
      if (!cancelled) onError?.(error);
    } finally {
      if (!cancelled) {
        timeoutId = window.setTimeout(load, 4000);
      }
    }
  };

  load();

  return () => {
    cancelled = true;
    if (timeoutId) window.clearTimeout(timeoutId);
  };
}
