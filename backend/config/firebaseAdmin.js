import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const projectId = process.env.FIREBASE_PROJECT_ID || "skillswap-ce6f9";
const firebaseApiKey =
  process.env.FIREBASE_WEB_API_KEY || "AIzaSyDg2GokmZnivtv9pjRgYuksyA38afOrXiU";

if (!getApps().length) {
  initializeApp({ projectId });
}

async function verifyWithFirebaseRest(idToken) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    }
  );

  const data = await response.json();

  if (!response.ok || !data.users?.length) {
    throw new Error(data.error?.message || "Invalid Firebase ID token");
  }

  const firebaseUser = data.users[0];

  return {
    uid: firebaseUser.localId,
    email: firebaseUser.email,
    name: firebaseUser.displayName,
    picture: firebaseUser.photoUrl,
    email_verified: firebaseUser.emailVerified,
  };
}

export async function verifyGoogleIdToken(idToken) {
  try {
    return await getAuth().verifyIdToken(idToken);
  } catch (error) {
    const canUseRestFallback =
      error.code === "app/invalid-credential" ||
      error.message?.toLowerCase().includes("credential") ||
      error.message?.toLowerCase().includes("metadata");

    if (!canUseRestFallback) {
      throw error;
    }

    return verifyWithFirebaseRest(idToken);
  }
}
