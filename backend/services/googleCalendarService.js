import { getAuthorizedCalendarClient, markCalendarError } from "./googleOAuthService.js";

function toGoogleDate(date) {
  return new Date(date).toISOString();
}

function buildEventPayload(session) {
  const start = new Date(session.scheduledAt);
  const durationMinutes = Number(session.durationMinutes) || 60;
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const teacher = session.teacherId;
  const learner = session.learnerId;
  const skill = session.skill || "Skill exchange";

  return {
    summary: `Learning Session - ${skill}`,
    description: [
      `Teacher name: ${teacher?.name || "Teacher"}`,
      `Learner name: ${learner?.name || "Learner"}`,
      `Skill being taught: ${skill}`,
      session.meetingLink ? `Meeting link: ${session.meetingLink}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    start: {
      dateTime: toGoogleDate(start),
    },
    end: {
      dateTime: toGoogleDate(end),
    },
    attendees: [teacher, learner]
      .filter((person) => person?.email)
      .map((person) => ({
        email: person.email,
        displayName: person.name,
      })),
    reminders: {
      useDefault: false,
      overrides: [{ method: "popup", minutes: 30 }],
    },
  };
}

function normalizeCalendarError(error) {
  const status = error.response?.status || error.code;
  const message = error.response?.data?.error?.message || error.message || "Google Calendar failed";

  if (status === 401 || status === 403) {
    const authError = new Error("Google Calendar authorization failed. Please reconnect Calendar.");
    authError.status = 401;
    return authError;
  }

  const apiError = new Error(message);
  apiError.status = Number(status) || 502;
  return apiError;
}

export async function createCalendarEvent(session, organizerUserId) {
  try {
    const { calendar } = await getAuthorizedCalendarClient(organizerUserId);
    const { data } = await calendar.events.insert({
      calendarId: "primary",
      requestBody: buildEventPayload(session),
      sendUpdates: "all",
    });

    return data;
  } catch (error) {
    const normalized = normalizeCalendarError(error);
    await markCalendarError(organizerUserId, normalized.message);
    throw normalized;
  }
}

export async function updateCalendarEvent(session) {
  if (!session.googleCalendar?.eventId || !session.googleCalendar?.organizerUserId) {
    return null;
  }

  try {
    const { calendar } = await getAuthorizedCalendarClient(session.googleCalendar.organizerUserId);
    const { data } = await calendar.events.update({
      calendarId: session.googleCalendar.calendarId || "primary",
      eventId: session.googleCalendar.eventId,
      requestBody: buildEventPayload(session),
      sendUpdates: "all",
    });

    return data;
  } catch (error) {
    const normalized = normalizeCalendarError(error);
    await markCalendarError(session.googleCalendar.organizerUserId, normalized.message);
    throw normalized;
  }
}

export async function deleteCalendarEvent(session) {
  if (!session.googleCalendar?.eventId || !session.googleCalendar?.organizerUserId) {
    return;
  }

  try {
    const { calendar } = await getAuthorizedCalendarClient(session.googleCalendar.organizerUserId);
    await calendar.events.delete({
      calendarId: session.googleCalendar.calendarId || "primary",
      eventId: session.googleCalendar.eventId,
      sendUpdates: "all",
    });
  } catch (error) {
    const normalized = normalizeCalendarError(error);
    if (normalized.status === 410 || normalized.status === 404) return;
    await markCalendarError(session.googleCalendar.organizerUserId, normalized.message);
    throw normalized;
  }
}
