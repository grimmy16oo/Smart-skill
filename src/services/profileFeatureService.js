import { apiRequest } from "./api";

async function api(method, path, body) {
  const cleanPath = path.startsWith("/api") ? path.slice(4) : path;
  const options = { method };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  return apiRequest(cleanPath, options);
}

// 1. AVAILABILITY
export function getUserAvailability(uid) {
  return api("GET", `/api/users/${uid}/availability`);
}

export function updateUserAvailability(uid, availability) {
  return api("PUT", `/api/users/${uid}/availability`, availability);
}

export function bookSession(data) {
  return api("POST", `/api/sessions`, data);
}

// 2. PROJECTS
export function getUserProjects(uid) {
  return api("GET", `/api/users/${uid}/projects`);
}

export function addProject(uid, data) {
  return api("POST", `/api/users/${uid}/projects`, data);
}

export function updateProject(projectId, data) {
  return api("PUT", `/api/projects/${projectId}`, data);
}

export function deleteProject(projectId) {
  return api("DELETE", `/api/projects/${projectId}`);
}

export async function fetchGitHubMeta(githubUrl) {
  try {
    const match = githubUrl.match(/github\.com\/([^/]+)\/([^/?#]+)/);
    if (!match) return null;

    const [, owner, repo] = match;
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        Accept: "application/vnd.github+json",
      },
    });

    if (!res.ok) return null;

    const data = await res.json();

    return {
      name: data.name,
      description: data.description ?? "",
      stars: data.stargazers_count ?? 0,
    };
  } catch {
    return null;
  }
}

// 3. ACTIVITY
export function getUserActivities(uid, limit = 50) {
  return api("GET", `/api/users/${uid}/activities?limit=${limit}`).then((activities = []) =>
    activities.map((activity) => ({
      id: activity.id || activity._id,
      ...activity,
    }))
  );
}

export function logActivity(uid, data) {
  return api("POST", `/api/activities`, {
    userId: uid,
    ...data,
  });
}

// 4. PRESENCE
export function getPresence(uid) {
  return api("GET", `/api/presence/${uid}`);
}

export function updatePresenceStatus(uid, status, statusDetail = "") {
  return api("PUT", `/api/presence/${uid}`, {
    status,
    statusDetail,
  });
}

export function startPresence(uid, status = "online") {
  const send = () => updatePresenceStatus(uid, status).catch(() => {});
  send();

  const interval = setInterval(send, 60000);

  return () => {
    clearInterval(interval);
    updatePresenceStatus(uid, "away").catch(() => {});
  };
}

export function subscribeToPresence(uid, cb) {
  let stopped = false;

  const poll = async () => {
    try {
      const data = await getPresence(uid);
      if (!stopped) cb(data);
  } catch {
    // Ignore transient presence read failures; the next poll will retry.
  }
  };

  poll();
  const interval = setInterval(poll, 30000);

  return () => {
    stopped = true;
    clearInterval(interval);
  };
}

// 5. SKILLS
export async function getSkillMeta(uid) {
  const data = await api("GET", `/api/users/${uid}/skill-meta`);
  return data?.skills ?? [];
}

export function updateSkillMeta(uid, skills) {
  return api("PUT", `/api/users/${uid}/skill-meta`, { skills });
}

export function endorseSkill(uid, skillName) {
  return api(
    "POST",
    `/api/users/${uid}/skills/${encodeURIComponent(skillName)}/endorse`
  );
}

// 6. NOTIFICATIONS
export function getNotifPrefs(uid) {
  return api("GET", `/api/users/${uid}/notif-prefs`);
}

export function updateNotifPrefs(uid, prefs) {
  return api("PUT", `/api/users/${uid}/notif-prefs`, prefs);
}
