"use client";

import { createContext, useContext } from "react";

const AuthContext = createContext<string>("");

export function AuthProvider({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  return <AuthContext.Provider value={userId}>{children}</AuthContext.Provider>;
}

export function useUserId(): string {
  const userId = useContext(AuthContext);
  if (!userId) {
    throw new Error("useUserId must be used within AuthProvider");
  }
  return userId;
}
