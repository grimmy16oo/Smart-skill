import { apiRequest, clearToken, normalizeUser, setToken } from "./api";
import { buildAvatarUrl } from "./userService";
import { auth } from "../firebase";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "firebase/auth";

/* ================= ERROR MAPPING ================= */
function mapAuthError(error) {
  if (error.status === 409) error.code = "auth/email-already-in-use";
  if (error.status === 401) error.code = "auth/wrong-password";

  if (
    error.status === 400 &&
    error.message?.toLowerCase().includes("email")
  ) {
    error.code = "auth/invalid-email";
  }

  return error;
}

/* ================= SAFE RESPONSE HANDLER ================= */
function storeAuthResponse(data) {
  // 💥 HANDLE DIFFERENT BACKEND SHAPES SAFELY
  const token = data.token || data.data?.token;
  const user = data.user || data.data?.user;

  if (!token) {
    throw new Error("No token received from server");
  }

  setToken(token);

  return normalizeUser(user);
}

/* ================= REGISTER ================= */
export async function registerWithProfile(email, password, profile) {
  try {
    const data = await apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: profile.name,
        email: email.trim().toLowerCase(),
        password,
        avatar:
          profile.avatar ||
          buildAvatarUrl(profile.name || email),
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

/* ================= LOGIN ================= */
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

/* ================= GOOGLE LOGIN ================= */
export async function loginWithGoogle() {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    const credential = await signInWithPopup(auth, provider);
    const idToken = await credential.user.getIdToken();

    const data = await apiRequest("/auth/google", {
      method: "POST",
      body: JSON.stringify({ idToken }),
    });

    return storeAuthResponse(data);
  } catch (error) {
    throw mapAuthError(error);
  }
}

/* ================= CURRENT USER ================= */
export async function getCurrentUser() {
  const data = await apiRequest("/auth/me");
  return normalizeUser(data.user || data.data?.user);
}

/* ================= LOGOUT ================= */
export async function logoutUser() {
  if (auth.currentUser) {
    await signOut(auth);
  }

  clearToken();
}
