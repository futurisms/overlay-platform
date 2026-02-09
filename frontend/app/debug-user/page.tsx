"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";

export default function DebugUserPage() {
  const [userInfo, setUserInfo] = useState<any>(null);
  const [rawLocalStorage, setRawLocalStorage] = useState<string>("");

  useEffect(() => {
    const user = getCurrentUser();
    setUserInfo(user);

    // Get raw localStorage value
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('user_info');
      setRawLocalStorage(raw || 'null');
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-6">
      <div className="container mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">User Debug Info</h1>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Current User Object</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-slate-900 text-green-400 p-4 rounded overflow-x-auto">
              {JSON.stringify(userInfo, null, 2)}
            </pre>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Raw localStorage.user_info</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-slate-900 text-green-400 p-4 rounded overflow-x-auto">
              {rawLocalStorage}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Role Check</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <strong>user?.role:</strong> {userInfo?.role || 'undefined'}
              </div>
              <div>
                <strong>typeof user?.role:</strong> {typeof userInfo?.role}
              </div>
              <div>
                <strong>user?.role === 'admin':</strong>{' '}
                {String(userInfo?.role === 'admin')}
              </div>
              <div>
                <strong>Button should appear:</strong>{' '}
                <span className={userInfo?.role === 'admin' ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                  {userInfo?.role === 'admin' ? 'YES ✅' : 'NO ❌'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <h3 className="font-bold mb-2">⚠️ Important:</h3>
          <p className="text-sm">
            If the role is <code>undefined</code> or missing, you need to:
          </p>
          <ol className="list-decimal ml-6 mt-2 text-sm">
            <li>Logout completely</li>
            <li>Login again (this will fetch the role from database)</li>
            <li>Check this page again</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
