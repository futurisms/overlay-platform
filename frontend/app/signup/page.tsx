"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle, UserPlus, Mail, User, Lock, AlertTriangle } from "lucide-react";
import { apiClient } from "@/lib/api-client";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token");

  const [isLoadingInvitation, setIsLoadingInvitation] = useState(true);
  const [invitation, setInvitation] = useState<any>(null);
  const [invitationError, setInvitationError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setInvitationError("Invalid invitation link. No token provided.");
      setIsLoadingInvitation(false);
      return;
    }

    loadInvitation();
  }, [token]);

  const loadInvitation = async () => {
    if (!token) return;

    setIsLoadingInvitation(true);
    setInvitationError(null);

    try {
      const result = await apiClient.getInvitation(token);

      if (result.error) {
        if (result.status === 404) {
          setInvitationError("Invitation not found. The link may be invalid.");
        } else if (result.status === 410) {
          setInvitationError("This invitation has expired. Please contact the administrator for a new invitation.");
        } else if (result.status === 409) {
          setInvitationError("This invitation has already been used. Please login with your existing account.");
        } else {
          setInvitationError(result.error);
        }
      } else if (result.data?.invitation) {
        setInvitation(result.data.invitation);
      }
    } catch (err) {
      setInvitationError("Failed to load invitation details");
      console.error(err);
    } finally {
      setIsLoadingInvitation(false);
    }
  };

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 12) {
      return "Password must be at least 12 characters long";
    }
    if (!/[A-Z]/.test(pwd)) {
      return "Password must contain at least one uppercase letter";
    }
    if (!/[a-z]/.test(pwd)) {
      return "Password must contain at least one lowercase letter";
    }
    if (!/[0-9]/.test(pwd)) {
      return "Password must contain at least one number";
    }
    if (!/[!@#$%^&*]/.test(pwd)) {
      return "Password must contain at least one special character (!@#$%^&*)";
    }
    return null;
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (value.length > 0) {
      const error = validatePassword(value);
      setPasswordError(error);
    } else {
      setPasswordError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      setSubmitError("Invalid token");
      return;
    }

    // Validation
    if (!name.trim()) {
      setSubmitError("Name is required");
      return;
    }

    const passwordValidation = validatePassword(password);
    if (passwordValidation) {
      setSubmitError(passwordValidation);
      return;
    }

    if (password !== confirmPassword) {
      setSubmitError("Passwords do not match");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await apiClient.acceptInvitation(token, name, password);

      if (result.error) {
        if (result.status === 410) {
          setSubmitError("This invitation has expired. Please contact the administrator.");
        } else if (result.status === 409) {
          setSubmitError("This invitation has already been used.");
        } else {
          setSubmitError(result.error);
        }
      } else if (result.data?.user) {
        // Success - redirect to login
        router.push("/login?message=Account created successfully. Please login.");
      }
    } catch (err) {
      setSubmitError("Failed to create account");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingInvitation) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-slate-600" />
          <p className="text-slate-600 dark:text-slate-400">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (invitationError) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <CardTitle className="text-center">Invitation Invalid</CardTitle>
            <CardDescription className="text-center">{invitationError}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button
                onClick={() => router.push("/login")}
                variant="outline"
                className="w-full"
              >
                Go to Login
              </Button>
              <p className="text-xs text-center text-slate-500 dark:text-slate-400">
                If you need a new invitation, please contact your administrator.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
              <UserPlus className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <CardTitle className="text-center text-2xl">Create Your Account</CardTitle>
          <CardDescription className="text-center">
            You've been invited to join the Overlay Platform as an analyst
          </CardDescription>
        </CardHeader>

        <CardContent>
          {invitation && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Invitation Details
              </h4>
              <div className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
                <p><strong>Session:</strong> {invitation.session_name}</p>
                <p><strong>Invited by:</strong> {invitation.invited_by_name}</p>
                <p><strong>Email:</strong> {invitation.email}</p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                  Expires: {new Date(invitation.expires_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}

          {submitError && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email (read-only) */}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email Address
              </label>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  value={invitation?.email || ""}
                  disabled
                  className="flex-1 bg-slate-100 dark:bg-slate-800"
                />
              </div>
            </div>

            {/* Full Name */}
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Full Name <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-slate-400" />
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSubmitting}
                  className="flex-1"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  disabled={isSubmitting}
                  className="flex-1"
                  required
                />
              </div>
              {passwordError && (
                <p className="text-xs text-red-600 dark:text-red-400">{passwordError}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <label htmlFor="confirm-password" className="text-sm font-medium">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-slate-400" />
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isSubmitting}
                  className="flex-1"
                  required
                />
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-600 dark:text-red-400">Passwords do not match</p>
              )}
            </div>

            {/* Password Requirements */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                Password Requirements:
              </p>
              <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <li className="flex items-center gap-2">
                  {password.length >= 12 ? (
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                  ) : (
                    <div className="h-3 w-3 rounded-full border border-slate-300" />
                  )}
                  At least 12 characters
                </li>
                <li className="flex items-center gap-2">
                  {/[A-Z]/.test(password) ? (
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                  ) : (
                    <div className="h-3 w-3 rounded-full border border-slate-300" />
                  )}
                  One uppercase letter
                </li>
                <li className="flex items-center gap-2">
                  {/[a-z]/.test(password) ? (
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                  ) : (
                    <div className="h-3 w-3 rounded-full border border-slate-300" />
                  )}
                  One lowercase letter
                </li>
                <li className="flex items-center gap-2">
                  {/[0-9]/.test(password) ? (
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                  ) : (
                    <div className="h-3 w-3 rounded-full border border-slate-300" />
                  )}
                  One number
                </li>
                <li className="flex items-center gap-2">
                  {/[!@#$%^&*]/.test(password) ? (
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                  ) : (
                    <div className="h-3 w-3 rounded-full border border-slate-300" />
                  )}
                  One special character (!@#$%^&*)
                </li>
              </ul>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || !name.trim() || !password || !confirmPassword || password !== confirmPassword || !!passwordError}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create Account
                </>
              )}
            </Button>

            <p className="text-xs text-center text-slate-500 dark:text-slate-400 mt-4">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
              >
                Login here
              </button>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-slate-600" />
          <p className="text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}
