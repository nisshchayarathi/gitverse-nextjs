"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import { buildApiUrl } from "../services/apiConfig";

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { data: session, status } = useSession();

  // Check for existing auth on mount (NextAuth or JWT)
  useEffect(() => {
    const checkAuth = async () => {
      // If NextAuth session exists, use it
      if (status === "loading") {
        return; // Still loading session
      }

      if (session?.user) {
        setUser({
          id: session.user.id || "",
          name: session.user.name || "",
          email: session.user.email || "",
          avatar:
            session.user.image ||
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${session.user.email}`,
        });
        setIsLoading(false);
        return;
      }

      // Otherwise, check for JWT token
      const token = localStorage.getItem("gitverse_token");

      if (token) {
        try {
          const response = await fetch(buildApiUrl("/api/auth/me"), {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            setUser({
              id: data.user.id.toString(),
              name: data.user.name,
              email: data.user.email,
              avatar:
                data.user.avatarUrl ||
                `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.user.email}`,
            });
          } else {
            // Token invalid, clear storage
            localStorage.removeItem("gitverse_token");
          }
        } catch (error) {
          console.error("Failed to verify auth:", error);
          localStorage.removeItem("gitverse_token");
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, [session, status]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);

    try {
      const response = await fetch(buildApiUrl("/api/auth/login"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      const newUser: User = {
        id: data.user.id.toString(),
        name: data.user.name,
        email: data.user.email,
        avatar:
          data.user.avatarUrl ||
          `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.user.email}`,
      };

      localStorage.setItem("gitverse_token", data.token);
      setUser(newUser);
    } catch (error) {
      setIsLoading(false);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (name: string, email: string, password: string) => {
    setIsLoading(true);

    try {
      const response = await fetch(buildApiUrl("/api/auth/signup"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Signup failed");
      }

      const newUser: User = {
        id: data.user.id.toString(),
        name: data.user.name,
        email: data.user.email,
        avatar:
          data.user.avatarUrl ||
          `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.user.email}`,
      };

      localStorage.setItem("gitverse_token", data.token);
      setUser(newUser);
    } catch (error) {
      setIsLoading(false);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    const token = localStorage.getItem("gitverse_token");

    // Handle JWT logout
    if (token) {
      try {
        await fetch(buildApiUrl("/api/auth/logout"), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (error) {
        console.error("Logout error:", error);
      }
      localStorage.removeItem("gitverse_token");
    }

    // Handle NextAuth logout
    if (session) {
      const { signOut } = await import("next-auth/react");
      await signOut({ redirect: false });
    }

    setUser(null);
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    signup,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
