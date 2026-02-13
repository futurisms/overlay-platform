"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LogIn, Loader2, Eye, EyeOff, Mail, Lock, KeyRound, CheckCircle, ArrowLeft } from "lucide-react";
import { login, saveUserInfo, forgotPassword, confirmForgotPassword } from "@/lib/auth";
import { apiClient } from "@/lib/api-client";

type ViewState = 'login' | 'forgotPassword' | 'resetPassword' | 'resetSuccess';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // View state management
  const [viewState, setViewState] = useState<ViewState>('login');

  // Login form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Forgot password form state
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Loading and error states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await login(email, password);

      if (result.success && result.token) {
        console.log('🔍 LOGIN DEBUG: Login successful, token received');
        console.log('🔍 LOGIN DEBUG: result.userInfo =', result.userInfo);

        // Save token to both localStorage and cookies
        apiClient.setToken(result.token);

        // Fetch user info from database to get role
        console.log('🔍 LOGIN DEBUG: Calling getCurrentUserInfo()...');
        const userInfoResult = await apiClient.getCurrentUserInfo();
        console.log('🔍 LOGIN DEBUG: getCurrentUserInfo() result =', userInfoResult);

        if (userInfoResult.data?.user) {
          console.log('🔍 LOGIN DEBUG: User data from database:', userInfoResult.data.user);

          // Save complete user info including role from database
          const completeUserInfo = {
            ...result.userInfo,
            role: userInfoResult.data.user.role,
            name: userInfoResult.data.user.name,
            user_id: userInfoResult.data.user.user_id,
          };

          console.log('🔍 LOGIN DEBUG: Complete user info to be saved:', completeUserInfo);
          saveUserInfo(completeUserInfo);
          console.log('🔍 LOGIN DEBUG: User info saved to localStorage');
        } else if (result.userInfo) {
          console.log('⚠️ LOGIN DEBUG: Database fetch failed or returned no user, falling back to Cognito info');
          console.log('⚠️ LOGIN DEBUG: userInfoResult =', userInfoResult);
          // Fallback to Cognito user info if database fetch fails
          saveUserInfo(result.userInfo);
        }

        // Save token to cookies for middleware
        document.cookie = `auth_token=${result.token}; path=/; max-age=${7 * 24 * 60 * 60}`; // 7 days

        // Get callback URL from query params
        const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

        // Redirect to callback URL or dashboard
        router.push(callbackUrl);
      } else {
        setError(result.error || "Login failed");
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const result = await forgotPassword(email);

      if (result.success) {
        setSuccessMessage(result.message || 'Check your email for a reset code');
        setViewState('resetPassword');
      } else {
        setError(result.error || 'Failed to send reset code');
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const result = await confirmForgotPassword(email, resetCode, newPassword);

      if (result.success) {
        setSuccessMessage(result.message || 'Password reset successfully');
        setViewState('resetSuccess');
        // Clear form
        setPassword("");
        setResetCode("");
        setNewPassword("");
      } else {
        setError(result.error || 'Failed to reset password');
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const backToLogin = () => {
    setViewState('login');
    setError(null);
    setSuccessMessage(null);
    setResetCode("");
    setNewPassword("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">Overlay Platform</CardTitle>
          <CardDescription>
            {viewState === 'login' && 'Sign in to access AI document analysis'}
            {viewState === 'forgotPassword' && 'Reset your password'}
            {viewState === 'resetPassword' && 'Enter reset code'}
            {viewState === 'resetSuccess' && 'Password reset successful'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* LOGIN FORM */}
          {viewState === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="you@example.com"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter your password"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => setViewState('forgotPassword')}
                    className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 transition-colors"
                    disabled={isLoading}
                  >
                    Forgot your password?
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Sign In
                  </>
                )}
              </Button>
            </form>
          )}

          {/* FORGOT PASSWORD FORM */}
          {viewState === 'forgotPassword' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <label htmlFor="reset-email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="you@example.com"
                    required
                    disabled={isLoading}
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  We'll send a verification code to this email
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending code...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Reset Code
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={backToLogin}
                disabled={isLoading}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Sign In
              </Button>
            </form>
          )}

          {/* RESET PASSWORD FORM */}
          {viewState === 'resetPassword' && (
            <form onSubmit={handleConfirmReset} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {successMessage && (
                <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                  <AlertDescription className="text-green-800 dark:text-green-200">
                    {successMessage}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <label htmlFor="reset-code" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Verification Code
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    id="reset-code"
                    type="text"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter 6-digit code"
                    required
                    disabled={isLoading}
                    maxLength={6}
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Check your email for the verification code
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="new-password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter new password"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    disabled={isLoading}
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Must be at least 12 characters with uppercase, lowercase, number, and special character
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resetting password...
                  </>
                ) : (
                  <>
                    <KeyRound className="mr-2 h-4 w-4" />
                    Reset Password
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={backToLogin}
                disabled={isLoading}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Sign In
              </Button>
            </form>
          )}

          {/* SUCCESS STATE */}
          {viewState === 'resetSuccess' && (
            <div className="space-y-4 text-center py-4">
              <div className="flex justify-center">
                <CheckCircle className="h-16 w-16 text-green-500" />
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Password Reset Successfully!
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Your password has been changed. You can now sign in with your new password.
                </p>
              </div>

              <Button
                className="w-full"
                onClick={backToLogin}
              >
                <LogIn className="mr-2 h-4 w-4" />
                Sign In
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-400" />
          </CardContent>
        </Card>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
