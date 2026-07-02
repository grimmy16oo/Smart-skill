import jwt from "jsonwebtoken";
import { google } from "googleapis";
import GoogleCredential from "../models/GoogleCredential.js";
import { decryptToken, encryptToken } from "../utils/tokenCrypto.js";

const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];

function getJwtSecret() {
  return process.env.JWT_SECRET || "dev-secret-change-me";
}

export function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_CALENDAR_REDIRECT_URI ||
    "http://localhost:5000/api/calendar/oauth/callback";

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth is not configured");
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function buildCalendarAuthUrl(userId) {
  const oauth2Client = getOAuthClient();
  const state = jwt.sign(
    { userId: userId.toString(), purpose: "google-calendar" },
    getJwtSecret(),
    { expiresIn: "10m" }
  );

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    include_granted_scopes: true,
    prompt: "consent",
    scope: CALENDAR_SCOPES,
    state,
  });
}

export async function saveCalendarTokens({ code, state }) {
  let payload;

  try {
    payload = jwt.verify(state, getJwtSecret());
  } catch {
    throw new Error("Google authorization expired. Please try connecting again.");
  }

  if (payload.purpose !== "google-calendar" || !payload.userId) {
    throw new Error("Invalid Google authorization request");
  }

  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  const { data: googleProfile } = await oauth2.userinfo.get();

  const existing = await GoogleCredential.findOne({ user: payload.userId }).select(
    "+encryptedAccessToken +encryptedRefreshToken"
  );

  const refreshToken = tokens.refresh_token
    ? encryptToken(tokens.refresh_token)
    : existing?.encryptedRefreshToken || "";

  if (!refreshToken) {
    throw new Error("Google did not return a refresh token. Revoke access and connect again.");
  }

  await GoogleCredential.findOneAndUpdate(
    { user: payload.userId },
    {
      user: payload.userId,
      googleEmail: googleProfile.email || "",
      encryptedAccessToken: encryptToken(tokens.access_token || ""),
      encryptedRefreshToken: refreshToken,
      tokenType: tokens.token_type || "Bearer",
      scope: tokens.scope || CALENDAR_SCOPES.join(" "),
      expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      connectedAt: new Date(),
      lastError: "",
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return payload.userId;
}

export async function getCalendarConnection(userId) {
  const credential = await GoogleCredential.findOne({ user: userId });

  return {
    connected: Boolean(credential),
    googleEmail: credential?.googleEmail || "",
    connectedAt: credential?.connectedAt || null,
    lastError: credential?.lastError || "",
  };
}

export async function getAuthorizedCalendarClient(userId) {
  const credential = await GoogleCredential.findOne({ user: userId }).select(
    "+encryptedAccessToken +encryptedRefreshToken"
  );

  if (!credential?.encryptedRefreshToken) {
    const error = new Error("Connect Google Calendar before scheduling this session.");
    error.status = 428;
    throw error;
  }

  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({
    access_token: decryptToken(credential.encryptedAccessToken),
    refresh_token: decryptToken(credential.encryptedRefreshToken),
    token_type: credential.tokenType,
    scope: credential.scope,
    expiry_date: credential.expiryDate?.getTime(),
  });

  oauth2Client.on("tokens", async (tokens) => {
    const updates = {};
    if (tokens.access_token) updates.encryptedAccessToken = encryptToken(tokens.access_token);
    if (tokens.refresh_token) updates.encryptedRefreshToken = encryptToken(tokens.refresh_token);
    if (tokens.expiry_date) updates.expiryDate = new Date(tokens.expiry_date);
    if (Object.keys(updates).length) {
      await GoogleCredential.findByIdAndUpdate(credential._id, {
        ...updates,
        lastError: "",
      });
    }
  });

  return {
    calendar: google.calendar({ version: "v3", auth: oauth2Client }),
    googleEmail: credential.googleEmail,
  };
}

export async function disconnectCalendar(userId) {
  await GoogleCredential.deleteOne({ user: userId });
}

export async function markCalendarError(userId, message) {
  await GoogleCredential.findOneAndUpdate(
    { user: userId },
    { lastError: String(message || "").slice(0, 500) }
  );
}
