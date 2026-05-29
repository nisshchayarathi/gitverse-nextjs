"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useRef, useCallback } from "react";
import { User, Lock, Shield, Trash2, AlertCircle, Save, Cpu } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  toast,
  EmptyState,
} from "@/components/ui";
import SettingsSkeleton from "@/components/ui/SettingsSkeleton";
import { useAuth } from "@/contexts/AuthContext";
import { buildApiUrl } from "@/services/apiConfig";
import axios from "axios";
import { useAISettings, AIProviderType } from "@/hooks/useAISettings";

export default function Settings() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");
  const [isLoading, setIsLoading] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const didInitProfileForm = useRef(false);

  // Profile state
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [avatar, setAvatar] = useState(user?.avatar || "");

  const initialEmailRef = useRef<string>(user?.email || "");
  const [isGoogleLinked, setIsGoogleLinked] = useState<boolean | null>(null);
  const [emailChangeNewPassword, setEmailChangeNewPassword] = useState("");

  // When using Google login, `user` arrives async from NextAuth session.
  // Initialize the form once when the user becomes available.
  useEffect(() => {
    if (!user || didInitProfileForm.current) return;
    setName(user.name || "");
    setEmail(user.email || "");
    setAvatar(user.avatar || "");
    initialEmailRef.current = user.email || "";
    didInitProfileForm.current = true;
  }, [user]);

  const [userFetchStatus, setUserFetchStatus] = useState<
    "loading" | "success" | "error" | "empty"
  >("loading");

  const fetchUserInfo = useCallback(async () => {
    setUserFetchStatus("loading");
    try {
      const token = localStorage.getItem("gitverse_token");
      const res = await axios.get(buildApiUrl("/api/users/me"), {
        withCredentials: true,
        timeout: 5000,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!res.data) {
        setUserFetchStatus("empty");
        setIsGoogleLinked(null);
        return;
      }

      setIsGoogleLinked(!!res.data?.isGoogleLinked);
      setUserFetchStatus("success");
    } catch (err) {
      console.error("Error fetching user info:", err);
      setIsGoogleLinked(null);
      setUserFetchStatus("error");
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    fetchUserInfo();
  }, [authLoading, fetchUserInfo]);

  useEffect(() => {
  return () => {
    if (avatar?.startsWith("blob:")) {
      URL.revokeObjectURL(avatar);
    }
  };
}, [avatar]);

  // AI Settings State
  const { settings, updateSettings, isLoaded: isAISettingsLoaded } = useAISettings();
  const [aiProvider, setAiProvider] = useState<AIProviderType>("gemini");
  const [aiGeminiKey, setAiGeminiKey] = useState("");
  const [aiOpenaiKey, setAiOpenaiKey] = useState("");

  useEffect(() => {
    if (isAISettingsLoaded) {
      setAiProvider(settings.provider);
      setAiGeminiKey(settings.geminiKey);
      setAiOpenaiKey(settings.openaiKey);
    }
  }, [settings, isAISettingsLoaded]);

  const handleSaveAISettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      provider: aiProvider,
      geminiKey: aiGeminiKey,
      openaiKey: aiOpenaiKey,
    });
    toast({
      title: "AI Settings Saved",
      description: "Your local AI provider and API keys have been updated.",
    });
  };

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const trimmedName = name.trim();
      const trimmedEmail = email.trim();

      if (!trimmedName) {
        toast({
          title: "Error",
          description: "Name is required",
          variant: "destructive",
        });
        return;
      }

      if (!trimmedEmail) {
        toast({
          title: "Error",
          description: "Email is required",
          variant: "destructive",
        });
        return;
      }

      // Basic email format validation (prevents incomplete/wrong format).
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        toast({
          title: "Error",
          description: "Please enter a valid email address",
          variant: "destructive",
        });
        return;
      }

      const isEmailChanging =
        !!initialEmailRef.current &&
        trimmedEmail.toLowerCase() !== initialEmailRef.current.toLowerCase();

      if (isEmailChanging && isGoogleLinked) {
        if (!emailChangeNewPassword) {
          toast({
            title: "New password required",
            description:
              "Changing your email will unlink Google. Set a new password to continue.",
            variant: "destructive",
          });
          return;
        }

        if (emailChangeNewPassword.length < 8) {
          toast({
            title: "Error",
            description: "Password must be at least 8 characters",
            variant: "destructive",
          });
          return;
        }
      }

      const token = localStorage.getItem("gitverse_token");
      const response = await axios.put(
        buildApiUrl("/api/users/profile"),
        {
          name: trimmedName,
          email: trimmedEmail,
          avatar,
          ...(isEmailChanging && isGoogleLinked
            ? { newPassword: emailChangeNewPassword }
            : {}),
        },
        {
          // If user is logged in via NextAuth (Google), rely on cookies.
          // If user is logged in via legacy JWT, send the Bearer token.
          withCredentials: true,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }
      );

      if (response.status === 200) {
        initialEmailRef.current = trimmedEmail;
        setEmailChangeNewPassword("");
        setName(trimmedName);
        setEmail(trimmedEmail);
        toast({
          title: "Profile Updated",
          description: "Your profile has been successfully updated",
        });
      }
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast({
        title: "Error",
        description:
          error?.response?.data?.error ||
          "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "Error",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem("gitverse_token");
      const response = await axios.post(
        buildApiUrl("/api/users/change-password"),
        {
          currentPassword,
          newPassword,
        },
        {
          withCredentials: true,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }
      );

      if (response.status === 200) {
        toast({
          title: "Password Changed",
          description: "Your password has been successfully updated",
        });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (error: any) {
      console.error("Error changing password:", error);
      toast({
        title: "Error",
        description:
          error.response?.data?.error || "Failed to change password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Error",
        description: "Please select a valid image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "Image size must be less than 5MB",
        variant: "destructive",
      });
      return;
    }

    // Convert to base64
    const previewUrl = URL.createObjectURL(file);

     setAvatar(previewUrl);

     toast ({
     title: "Avatar Updated",
    description: 'Click "Save Changes" to confirm the update',
});
  };

  const handleDeleteAccount = () => {
    setShowDeleteModal(true);
  };

  const confirmDeleteAccount = async () => {
    if (isDeletingAccount) return;

    setIsDeletingAccount(true);
    try {
      const token = localStorage.getItem("gitverse_token");
      await axios.delete(buildApiUrl("/api/users/me"), {
        withCredentials: true,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      await logout();

      toast({
        title: "Account deleted",
        description: "Your account has been deleted successfully.",
      });

      window.location.href = "/signup";
    } catch (error: any) {
      console.error("Error deleting account:", error);
      toast({
        title: "Error",
        description:
          error.response?.data?.error || "Failed to delete account",
        variant: "destructive",
      });
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "security", label: "Security", icon: Shield },
    { id: "ai", label: "AI Settings", icon: Cpu },
    { id: "danger", label: "Danger Zone", icon: Trash2 },
  ];

  // Early returns for loading / error / empty states to prevent layout shift
  if (userFetchStatus === "loading" || authLoading) {
    return (
      <DashboardLayout>
        <SettingsSkeleton />
      </DashboardLayout>
    );
  }

  if (userFetchStatus === "error") {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-heading font-bold mb-2">Settings</h1>
            <p className="text-muted-foreground">
              Manage your account settings and preferences
            </p>
          </div>

          <EmptyState
            icon={AlertCircle}
            title="Unable to load account"
            description="There was an error loading your account information. Check your connection and try again."
            actionLabel="Retry"
            onAction={fetchUserInfo}
          />
        </div>
      </DashboardLayout>
    );
  }

  if (userFetchStatus === "empty") {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-heading font-bold mb-2">Settings</h1>
            <p className="text-muted-foreground">
              Manage your account settings and preferences
            </p>
          </div>

          <EmptyState
            icon={User}
            title="No account found"
            description="We couldn't find user data for this account. Try signing in again or contact support."
            actionLabel="Reload"
            onAction={fetchUserInfo}
          />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-heading font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account settings and preferences
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Tabs */}
          <div className="lg:col-span-1">
            <Card className="glass">
              <CardContent className="pt-6">
                <nav className="space-y-1">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left ${
                        activeTab === tab.id
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      <tab.icon className="h-5 w-5" />
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Content Area */}
          <div className="lg:col-span-3 space-y-6">
            {/* Profile Tab */}
            {activeTab === "profile" && (
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="font-heading flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Profile Information
                  </CardTitle>
                  <CardDescription>
                    Update your personal information
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSaveProfile} className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="name" className="text-sm font-medium">
                        Full Name
                      </label>
                      <Input
                        id="name"
                        type="text"
                        autoComplete="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="John Doe"
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="email" className="text-sm font-medium">
                        Email Address
                      </label>
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="john@example.com"
                        required
                      />
                      {isGoogleLinked !== null && (
                        <p className="text-xs text-muted-foreground">
                          Google account linked: {isGoogleLinked ? "Yes" : "No"}
                        </p>
                      )}
                    </div>

                    {isGoogleLinked &&
                      !!initialEmailRef.current &&
                      email.trim().toLowerCase() !==
                        initialEmailRef.current.toLowerCase() && (
                        <div className="space-y-2">
                          <label
                            htmlFor="email-change-password"
                            className="text-sm font-medium"
                          >
                            New Password (required to change email)
                          </label>
                          <Input
                            id="email-change-password"
                            type="password"
                            autoComplete="new-password"
                            value={emailChangeNewPassword}
                            onChange={(e) =>
                              setEmailChangeNewPassword(e.target.value)
                            }
                            placeholder="••••••••"
                          />
                          <p className="text-xs text-muted-foreground">
                            Changing email will unlink Google and require a new
                            password.
                          </p>
                        </div>
                      )}

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Avatar</label>
                      <div className="flex items-center gap-4">
                        <div className="h-16 w-16 rounded-full bg-gradient-primary flex items-center justify-center overflow-hidden">
                          {avatar ? (
                            <img
                              src={avatar}
                              alt={name}
                              className="w-full h-full object-cover"
                            />
                          ) : user?.avatar ? (
                            <img
                              src={user.avatar}
                              alt={user.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="h-8 w-8 text-primary-foreground" />
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleAvatarClick}
                          >
                            Change Avatar
                          </Button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleAvatarChange}
                          />
                          <p className="text-xs text-muted-foreground">
                            Max 5MB, JPG/PNG/GIF
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4">
                      <Button
                        type="submit"
                        disabled={isLoading}
                        className="bg-gradient-primary hover:opacity-90 transition-opacity"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {isLoading ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Security Tab */}
            {activeTab === "security" && (
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="font-heading flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Password & Security
                  </CardTitle>
                  <CardDescription>Keep your account secure</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div className="space-y-2">
                      <label
                        htmlFor="current-password"
                        className="text-sm font-medium"
                      >
                        Current Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                          id="current-password"
                          type="password"
                          value={currentPassword}
                          autoComplete="current-password"
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="pl-10"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label
                        htmlFor="new-password"
                        className="text-sm font-medium"
                      >
                        New Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                          id="new-password"
                          type="password"
                          autoComplete="new-password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="pl-10"
                          placeholder="••••••••"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Must be at least 8 characters
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label
                        htmlFor="confirm-password"
                        className="text-sm font-medium"
                      >
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                          id="confirm-password"
                          type="password"
                          autoComplete="new-password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="pl-10"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>

                    <div className="pt-4">
                      <Button
                        type="submit"
                        disabled={isLoading}
                        className="bg-gradient-primary hover:opacity-90 transition-opacity"
                      >
                        <Lock className="h-4 w-4 mr-2" />
                        {isLoading ? "Updating..." : "Update Password"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* AI Settings Tab */}
            {activeTab === "ai" && (
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="font-heading flex items-center gap-2">
                    <Cpu className="h-5 w-5" />
                    AI Summary Settings
                  </CardTitle>
                  <CardDescription>
                    Configure your AI provider to generate module and file summaries. Keys are stored securely in your browser&apos;s localStorage.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSaveAISettings} className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="ai-provider" className="text-sm font-medium">
                        AI Provider
                      </label>
                      <select
                        id="ai-provider"
                        value={aiProvider}
                        onChange={(e) => setAiProvider(e.target.value as AIProviderType)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="gemini">Google Gemini</option>
                        <option value="openai">OpenAI</option>
                      </select>
                    </div>

                    {aiProvider === "gemini" && (
                      <div className="space-y-2">
                        <label htmlFor="gemini-key" className="text-sm font-medium">
                          Gemini API Key
                        </label>
                        <Input
                          id="gemini-key"
                          type="password"
                          placeholder="AIzaSy..."
                          value={aiGeminiKey}
                          onChange={(e) => setAiGeminiKey(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Enter your Google Gemini API Key. Get one from Google AI Studio.
                        </p>
                      </div>
                    )}

                    {aiProvider === "openai" && (
                      <div className="space-y-2">
                        <label htmlFor="openai-key" className="text-sm font-medium">
                          OpenAI API Key
                        </label>
                        <Input
                          id="openai-key"
                          type="password"
                          placeholder="sk-..."
                          value={aiOpenaiKey}
                          onChange={(e) => setAiOpenaiKey(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Enter your OpenAI API Key.
                        </p>
                      </div>
                    )}

                    <div className="pt-4">
                      <Button
                        type="submit"
                        className="bg-gradient-primary hover:opacity-90 transition-opacity"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save AI Settings
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Danger Zone Tab */}
            {activeTab === "danger" && (
              <Card className="glass border-destructive/50">
                <CardHeader>
                  <CardTitle className="font-heading flex items-center gap-2 text-destructive">
                    <Trash2 className="h-5 w-5" />
                    Danger Zone
                  </CardTitle>
                  <CardDescription>
                    Irreversible and destructive actions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/5">
                    <h3 className="font-medium mb-2">Delete Account</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Once you delete your account, there is no going back.
                      Please be certain.
                    </p>
                    <Button
                      variant="destructive"
                      onClick={handleDeleteAccount}
                      disabled={isDeletingAccount}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {isDeletingAccount ? "Deleting..." : "Delete Account"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
      {showDeleteModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
          onKeyDown={(e) => e.key === "Escape" && setShowDeleteModal(false)}
          onClick={(e) => e.target === e.currentTarget && setShowDeleteModal(false)}
        >
          <Card className="w-full max-w-sm">
            <CardHeader>
              <CardTitle id="delete-account-title">Delete Account</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-6">
                This permanently deletes your account and all data. This cannot be undone.
              </p>

              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancel
                </Button>

                <Button
                  variant="destructive"
                  onClick={() => {
                    setShowDeleteModal(false);
                    confirmDeleteAccount();
                  }}
                  disabled={isDeletingAccount}
                >
                  {isDeletingAccount ? "Deleting..." : "Delete Account"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

    </DashboardLayout>
  );
}
