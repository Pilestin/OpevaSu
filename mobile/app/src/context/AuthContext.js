import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authApi } from "../services/api";

const STORAGE_KEYS = {
  token: "opevasu_token",
  authMode: "opevasu_auth_mode",
  user: "opevasu_user",
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);
  const [authMode, setAuthMode] = useState("bearer");
  const [user, setUser] = useState(null);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const [storedToken, storedAuthMode, storedUser] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.token),
          AsyncStorage.getItem(STORAGE_KEYS.authMode),
          AsyncStorage.getItem(STORAGE_KEYS.user),
        ]);

        if (storedToken) {
          if (storedAuthMode === "session") {
            try {
              const rawSessionId = storedToken.replace(/^Session\s+/i, "");
              const response = await authApi.me({ sessionId: rawSessionId });
              setToken(`Session ${response.sessionId}`);
              setAuthMode("session");
              setUser(response.user);
              await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(response.user));
            } catch (error) {
              await Promise.all([
                AsyncStorage.removeItem(STORAGE_KEYS.token),
                AsyncStorage.removeItem(STORAGE_KEYS.authMode),
                AsyncStorage.removeItem(STORAGE_KEYS.user),
              ]);
            }
          } else if (storedUser) {
            setToken(storedToken);
            setAuthMode(storedAuthMode || "bearer");
            setUser(JSON.parse(storedUser));
          }
        }
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = async ({ userIdOrEmail, password, expectedRole }) => {
    const response = await authApi.login({ userIdOrEmail, password });
    const normalizedRole = String(response?.user?.role || "").toLowerCase();
    if (expectedRole && normalizedRole !== expectedRole) {
      throw new Error(`Bu hesap ${expectedRole} rolune uygun degil.`);
    }

    const accessHeader = `Bearer ${response.access_token}`;
    setToken(accessHeader);
    setAuthMode("bearer");
    setUser(response.user);

    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEYS.token, accessHeader),
      AsyncStorage.setItem(STORAGE_KEYS.authMode, "bearer"),
      AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(response.user)),
    ]);
  };

  const loginDriver = async ({ userIdOrEmail, password }) => {
    const response = await authApi.loginDriver({ userIdOrEmail, password });
    const normalizedRole = String(response?.user?.role || "").toLowerCase();
    if (normalizedRole !== "driver") {
      throw new Error("Bu hesap driver rolune uygun degil.");
    }

    const sessionHeader = `Session ${response.sessionId}`;
    setToken(sessionHeader);
    setAuthMode("session");
    setUser(response.user);

    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEYS.token, sessionHeader),
      AsyncStorage.setItem(STORAGE_KEYS.authMode, "session"),
      AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(response.user)),
    ]);
  };

  const updateUser = async (nextUser) => {
    setUser(nextUser);
    await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(nextUser));
  };

  const logout = async () => {
    const currentToken = token;
    const currentAuthMode = authMode;
    setToken(null);
    setAuthMode("bearer");
    setUser(null);

    if (currentAuthMode === "session" && currentToken) {
      try {
        await authApi.logout({ sessionId: currentToken.replace(/^Session\s+/i, "") });
      } catch (error) {
        // Session may already be invalidated; local cleanup is still enough.
      }
    }

    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.token),
      AsyncStorage.removeItem(STORAGE_KEYS.authMode),
      AsyncStorage.removeItem(STORAGE_KEYS.user),
    ]);
  };

  const value = useMemo(
    () => ({
      loading,
      token,
      authMode,
      user,
      login,
      loginDriver,
      logout,
      updateUser,
    }),
    [loading, token, authMode, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}

