import { apiRequest, clearToken, normalizeUser, setToken } from "./api";
import { buildAvatarUrl } from "./userService";

function mapAuthError(error) {
  if (error.status === 409) error.code = "auth/email-already-in-use";
  if (error.status === 401) error.code = "auth/wrong-password";
  if (error.status === 400 && error.message.toLowerCase().includes("email")) {
    error.code = "auth/invalid-email";
  }
  return error;
}

function storeAuthResponse(data) {
  setToken(data.token);
  return normalizeUser(data.user);
}

export async function registerWithProfile(email, password, profile) {
  try {
    const data = await apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: profile.name,
        email: email.trim().toLowerCase(),
        password,
        avatar: profile.avatar || buildAvatarUrl(profile.name || email),
        bio: profile.bio || "",
        location: profile.location || "",
        skillsOffered: profile.skillsOffered || [],
        skillsWanted: profile.skillsWanted || [],
      }),
    });

    return storeAuthResponse(data);
  } catch (error) {
    throw mapAuthError(error);
  }
}

export async function loginUser(email, password) {
  try {
    const data = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
      }),
    });

    return storeAuthResponse(data);
  } catch (error) {
    throw mapAuthError(error);
  }
}

export async function getCurrentUser() {
  const data = await apiRequest("/auth/me");
  return normalizeUser(data.user);
}

export async function logoutUser() {
  clearToken();
}
