import { apiRequest } from "./api";

export async function getCalendarStatus() {
  const data = await apiRequest("/calendar/status");
  return data.calendar;
}

export async function connectGoogleCalendar() {
  const data = await apiRequest("/calendar/auth-url");
  if (!data.url) throw new Error("Could not start Google Calendar connection");
  window.location.href = data.url;
}

export async function disconnectGoogleCalendar() {
  await apiRequest("/calendar/connection", { method: "DELETE" });
}

export async function createLearningSession(payload) {
  const data = await apiRequest("/sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.session;
}

export async function getLearningSessions() {
  const data = await apiRequest("/sessions");
  return data.sessions || [];
}

export async function confirmLearningSession(sessionId, payload = {}) {
  const data = await apiRequest(`/sessions/${sessionId}/confirm`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.session;
}

export async function rescheduleLearningSession(sessionId, payload) {
  const data = await apiRequest(`/sessions/${sessionId}/reschedule`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return data.session;
}

export async function cancelLearningSession(sessionId) {
  const data = await apiRequest(`/sessions/${sessionId}`, {
    method: "DELETE",
  });
  return data.session;
}

export async function completeLearningSession(sessionId) {
  const data = await apiRequest(`/sessions/${sessionId}/complete`, {
    method: "POST",
  });
  return data.session;
}
