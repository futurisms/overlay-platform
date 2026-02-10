"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LogIn, Loader2 } from "lucide-react";
import { login, saveUserInfo } from "@/lib/auth";
import { apiClient } from "@/lib/api-client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">Overlay Platform</CardTitle>
          <CardDescription>Sign in to access AI document analysis</CardDescription>
        </CardHeader>
        <CardContent>
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
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="you@example.com"
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your password"
                required
                disabled={isLoading}
              />
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
