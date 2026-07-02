import { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  getCurrentUser,
  loginUser,
  loginWithGoogle as loginWithGoogleUser,
  logoutUser,
  registerWithProfile,
} from "../services/authService";
import { getToken, normalizeUser } from "../services/api";
import { getUserProfile } from "../services/userService";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const setSessionUser = useCallback((nextUser) => {
    const normalized = normalizeUser(nextUser);
    setUser(normalized);
    setProfile(normalized);
    return normalized;
  }, []);

  const loadProfile = useCallback(
    async (uid) => {
      if (!uid) {
        setProfile(null);
        return null;
      }

      setProfileLoading(true);
      try {
        const userProfile = await getUserProfile(uid);
        setProfile(userProfile);
        setUser((current) => normalizeUser({ ...current, ...userProfile }));
        return userProfile;
      } finally {
        setProfileLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    let cancelled = false;

    async function hydrateSession() {
      if (!getToken()) {
        setLoading(false);
        return;
      }

      try {
        const currentUser = await getCurrentUser();
        if (!cancelled) setSessionUser(currentUser);
      } catch (error) {
        console.error("Session hydrate failed:", error);
        if (!cancelled) {
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    hydrateSession();

    return () => {
      cancelled = true;
    };
  }, [setSessionUser]);

  const register = async (email, password, profileData) => {
    const createdUser = await registerWithProfile(email, password, profileData);
    setSessionUser(createdUser);
    return createdUser;
  };

  const login = async (email, password) => {
    const loggedInUser = await loginUser(email, password);
    setSessionUser(loggedInUser);
    return loggedInUser;
  };

  const loginWithGoogle = async () => {
    const loggedInUser = await loginWithGoogleUser();
    setSessionUser(loggedInUser);
    return loggedInUser;
  };

  const logout = async () => {
    await logoutUser();
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (!user?.uid) return null;
    return loadProfile(user.uid);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        profileLoading,
        register,
        login,
        loginWithGoogle,
        logout,
        refreshProfile,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
