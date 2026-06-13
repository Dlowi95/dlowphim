"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import Cookies from "js-cookie";

interface User {
  id: string;
  email: string;
  displayName: string;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginManual: (email: string, password: string) => Promise<void>;
  registerManual: (displayName: string, email: string, password: string) => Promise<void>;
  loginGoogle: (token: string, isAccessToken?: boolean) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthContextProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  const logout = () => {
    Cookies.remove("token");
    setUser(null);
  };

  const verifySession = async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        // Token has expired or is invalid
        if (res.status === 401) {
          console.warn("Session expired. Logging out...");
        }
        logout();
      }
    } catch (err) {
      console.error("Error verifying auth session:", err);
      logout();
    } finally {
      setLoading(false);
    }
  };

  // Run on mount to check if token cookie exists
  useEffect(() => {
    const token = Cookies.get("token");
    if (token) {
      verifySession(token);
    } else {
      setLoading(false);
    }
  }, []);

  const saveTokenAndUser = (token: string, userData: User) => {
    // Cookie expires in exactly 8 hours
    const expires = new Date(new Date().getTime() + 8 * 60 * 60 * 1000);
    Cookies.set("token", token, { expires });
    setUser(userData);
  };

  const loginManual = async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Đăng nhập thất bại");
    }

    saveTokenAndUser(data.accessToken, data.user);
  };

  const registerManual = async (displayName: string, email: string, password: string) => {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ displayName, email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Đăng ký thất bại");
    }
  };

  const loginGoogle = async (token: string, isAccessToken = true) => {
    const body = isAccessToken ? { accessToken: token } : { idToken: token };
    const res = await fetch(`${API_URL}/auth/google`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Đăng nhập Google thất bại");
    }

    saveTokenAndUser(data.accessToken, data.user);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loginManual,
        registerManual,
        loginGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthContextProvider");
  }
  return context;
}
