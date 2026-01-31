"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ArrowLeft, FileText, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { getCurrentUser } from "@/lib/auth";

interface Submission {
  submission_id: string;
  session_name: string;
  document_name: string;
  status: string;
  submitted_at: string;
  overall_score?: number;
  session_id: string;
}

export default function SubmissionsPage() {
  const router = useRouter();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      router.push("/login");
      return;
    }
    setUser(currentUser);
    loadSubmissions();
  }, [router]);

  const loadSubmissions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await apiClient.getSubmissions();

      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        setSubmissions(result.data.submissions || []);
      }
    } catch (err) {
      setError("Failed to load submissions");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "processing":
        return <Clock className="h-5 w-5 text-blue-600" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <AlertCircle className="h-5 w-5 text-slate-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "default";
      case "processing":
        return "secondary";
      case "failed":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getScoreColor = (score?: number) => {
    if (!score) return "text-slate-600";
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-slate-600" />
          <p className="text-slate-600 dark:text-slate-400">Loading submissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" onClick={() => router.push("/dashboard")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-50 mb-2">
                My Analyses
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                View all your document analyses and their status
              </p>
            </div>
            <Button onClick={loadSubmissions} variant="outline">
              Refresh
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Submissions List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              All Analyses ({submissions.length})
            </CardTitle>
            <CardDescription>
              Click on an analysis to view detailed evaluation and feedback
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submissions.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-16 w-16 mx-auto mb-4 text-slate-400" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-2">
                  No analyses yet
                </h3>
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                  Upload a document to an analysis session to get started
                </p>
                <Button onClick={() => router.push("/dashboard")}>
                  Go to Dashboard
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {submissions.map((submission) => (
                  <Card
                    key={submission.submission_id}
                    className="cursor-pointer hover:border-blue-500 transition-colors"
                    onClick={() => router.push(`/submission/${submission.submission_id}`)}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            {getStatusIcon(submission.status)}
                            <div>
                              <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-50">
                                {submission.document_name}
                              </h3>
                              <p className="text-sm text-slate-600 dark:text-slate-400">
                                Session: {submission.session_name}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 mt-4">
                            <Badge variant={getStatusColor(submission.status)}>
                              {submission.status}
                            </Badge>

                            {submission.overall_score !== undefined && (
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-600 dark:text-slate-400">
                                  Score:
                                </span>
                                <span className={`font-bold text-lg ${getScoreColor(submission.overall_score)}`}>
                                  {submission.overall_score.toFixed(1)}%
                                </span>
                              </div>
                            )}

                            <span className="text-sm text-slate-500 dark:text-slate-500 ml-auto">
                              {new Date(submission.submitted_at).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
