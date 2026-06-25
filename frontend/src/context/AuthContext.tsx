"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Cookies from "js-cookie";

interface User {
  id: string;
  email: string;
  displayName: string;
  avatar?: string;
  favorites?: string[];
  watchHistory?: any[];
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginManual: (email: string, password: string) => Promise<void>;
  registerManual: (displayName: string, email: string, password: string) => Promise<void>;
  loginGoogle: (token: string, isAccessToken?: boolean) => Promise<void>;
  logout: () => void;
  showAuthToast: () => void;
  showToast: (message: string, type: "success" | "error" | "warning") => void;
  toggleFavorite: (slug: string) => Promise<boolean>;
  refreshUser: () => Promise<void>;
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

  const syncUserData = async (token: string) => {
    try {
      // 1. Sync Favorites
      let localFavs: string[] = [];
      try {
        localFavs = JSON.parse(localStorage.getItem("dlowphim_favorites") || "[]");
      } catch (e) {
        console.error(e);
      }

      const favRes = await fetch(`${API_URL}/auth/favorites/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ localFavorites: localFavs }),
      });

      let mergedFavs: string[] = [];
      if (favRes.ok) {
        const favData = await favRes.json();
        mergedFavs = favData.favorites || [];
        localStorage.setItem("dlowphim_favorites", JSON.stringify(mergedFavs));
      }

      // 2. Sync History
      let localHist: any[] = [];
      try {
        localHist = JSON.parse(localStorage.getItem("dlowphim_history") || "[]");
      } catch (e) {
        console.error(e);
      }

      const histRes = await fetch(`${API_URL}/auth/history/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ localHistory: localHist }),
      });

      let mergedHist: any[] = [];
      if (histRes.ok) {
        const histData = await histRes.json();
        mergedHist = histData.watchHistory || [];
        localStorage.setItem("dlowphim_history", JSON.stringify(mergedHist));
      }

      // Update user state with merged data
      setUser(prev => {
        if (!prev) return null;
        return {
          ...prev,
          favorites: mergedFavs,
          watchHistory: mergedHist,
        };
      });
    } catch (err) {
      console.error("Error syncing user data upon login:", err);
    }
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
        // Sync local storage with latest remote data
        if (data.favorites) {
          localStorage.setItem("dlowphim_favorites", JSON.stringify(data.favorites));
        }
        if (data.watchHistory) {
          localStorage.setItem("dlowphim_history", JSON.stringify(data.watchHistory));
        }
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
    
    // Trigger background sync
    syncUserData(token);
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

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "warning" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "warning") => {
    setToast({ message, type });
  };

  const showAuthToast = () => {
    showToast("Bạn phải đăng nhập để sử dụng tính năng này.", "warning");
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const toggleFavorite = async (slug: string): Promise<boolean> => {
    if (!user) {
      showAuthToast();
      return false;
    }
    try {
      const token = Cookies.get("token");
      const res = await fetch(`${API_URL}/auth/favorites/toggle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ movieSlug: slug }),
      });

      if (res.ok) {
        const data = await res.json();
        const favorites = data.favorites || [];
        localStorage.setItem("dlowphim_favorites", JSON.stringify(favorites));
        
        // Update user state globally in real-time
        setUser(prev => {
          if (!prev) return null;
          return {
            ...prev,
            favorites: favorites
          };
        });

        const wasAdded = favorites.includes(slug);
        if (wasAdded) {
          showToast("Đã thêm vào danh sách yêu thích", "success");
        } else {
          showToast("Đã xóa khỏi danh sách yêu thích", "success");
        }
        return wasAdded;
      }
    } catch (e) {
      console.error("Lỗi cập nhật yêu thích:", e);
    }
    return false;
  };

  const refreshUser = async () => {
    const token = Cookies.get("token");
    if (token) {
      await verifySession(token);
    }
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
        showAuthToast,
        showToast,
        toggleFavorite,
        refreshUser,
      }}
    >
      {children}
      {mounted && typeof window !== "undefined" && createPortal(
        toast && (
          <div 
            style={{
              position: "fixed",
              bottom: "32px",
              right: "32px",
              zIndex: 999999,
            }}
            className="animate-toast-slide-up select-none"
          >
            <style>{`
              @keyframes toast-progress-countdown {
                from {
                  transform: scaleX(1);
                }
                to {
                  transform: scaleX(0);
                }
              }
              .toast-progress-bar {
                animation: toast-progress-countdown 5000ms linear forwards;
              }
            `}</style>
            <div 
              style={{
                backgroundColor: "rgba(15, 17, 23, 0.72)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                color: "#ffffff",
                borderRadius: "16px",
                boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
                display: "flex",
                flexDirection: "column",
                width: "360px",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                overflow: "hidden"
              }}
            >
              <div className="flex items-center justify-between p-4 gap-3.5">
                <div className="flex items-center gap-3.5 text-left">
                  {/* Icon */}
                  <div 
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      backgroundColor: toast.type === "success" ? "#22c55e" : "#ef4444",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      boxShadow: toast.type === "success" 
                        ? "0 0 12px rgba(34, 197, 94, 0.5)" 
                        : "0 0 12px rgba(239, 68, 68, 0.5)",
                    }}
                    className="select-none text-white"
                  >
                    {toast.type === "success" ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="3.5"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="text-white font-black text-sm leading-none">!</span>
                    )}
                  </div>
                  {/* Text */}
                  <span className="text-sm font-semibold text-zinc-100 leading-snug">
                    {toast.message}
                  </span>
                </div>
                {/* Close Button */}
                <button
                  onClick={() => setToast(null)}
                  style={{
                    color: "rgba(255, 255, 255, 0.4)",
                    backgroundColor: "transparent",
                    border: "none",
                    padding: "6px",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#ffffff";
                    e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "rgba(255, 255, 255, 0.4)";
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="w-4 h-4"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* Dynamic progress animation with a background track */}
              <div style={{ width: "100%", height: "4px", backgroundColor: "rgba(255, 255, 255, 0.08)" }}>
                <div 
                  className="toast-progress-bar"
                  key={toast.message} // re-mount progress bar to restart animation if message changes
                  style={{
                    height: "4px",
                    backgroundColor: toast.type === "success" ? "#22c55e" : "#ef4444",
                    transformOrigin: "left",
                  }}
                />
              </div>
            </div>
          </div>
        ),
        document.body
      )}
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
