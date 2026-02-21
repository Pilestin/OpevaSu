import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authApi } from "../services/api";

const STORAGE_KEYS = {
  token: "opevasu_token",
  user: "opevasu_user",
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const [storedToken, storedUser] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.token),
          AsyncStorage.getItem(STORAGE_KEYS.user),
        ]);

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = async ({ userIdOrEmail, password }) => {
    const response = await authApi.login({ userIdOrEmail, password });
    setToken(response.access_token);
    setUser(response.user);

    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEYS.token, response.access_token),
      AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(response.user)),
    ]);
  };

  const updateUser = async (nextUser) => {
    setUser(nextUser);
    await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(nextUser));
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.token),
      AsyncStorage.removeItem(STORAGE_KEYS.user),
    ]);
  };

  const value = useMemo(
    () => ({
      loading,
      token,
      user,
      login,
      logout,
      updateUser,
    }),
    [loading, token, user]
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

