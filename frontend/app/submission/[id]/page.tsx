"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  ArrowLeft,
  FileText,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  Paperclip,
  Download,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { getCurrentUser } from "@/lib/auth";
import { toast } from "sonner";
import { TextSelectionHandler } from "@/components/TextSelectionHandler";

interface Question {
  question_id: string;
  question_text: string;
  priority: string;
  created_at: string;
  answers: Array<{
    answer_id: string;
    answer_text: string;
    answered_by_name: string;
    answered_at: string;
  }>;
}

export default function SubmissionPage() {
  const router = useRouter();
  const params = useParams();
  const submissionId = params?.id as string;

  const [submission, setSubmission] = useState<any>(null);
  const [feedback, setFeedback] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState<{ [key: string]: string }>({});
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState<string | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  useEffect(() => {
    // Check authentication
    const currentUser = getCurrentUser();
    if (!currentUser) {
      router.push("/login");
      return;
    }

    if (submissionId) {
      loadSubmissionData();
    }
  }, [submissionId, router]);

  // Auto-refresh when analysis is in progress
  useEffect(() => {
    if (!submission || submission.ai_analysis_status === "completed") {
      return;
    }

    // Poll every 10 seconds when analysis is not completed
    const intervalId = setInterval(() => {
      console.log("Auto-refreshing submission data...");
      loadSubmissionData();
    }, 10000);

    return () => clearInterval(intervalId);
  }, [submission?.ai_analysis_status]);

  const loadSubmissionData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load submission details, feedback, and questions
      const [submissionResult, feedbackResult, questionsResult] = await Promise.all([
        apiClient.getSubmission(submissionId),
        apiClient.getSubmissionFeedback(submissionId),
        apiClient.getAnswers(submissionId),
      ]);

      if (submissionResult.error) {
        setError(submissionResult.error);
      } else if (submissionResult.data) {
        setSubmission(submissionResult.data);
      }

      if (feedbackResult.data) {
        setFeedback(feedbackResult.data);
      }

      if (questionsResult.data) {
        setQuestions(questionsResult.data.questions || []);
      }
    } catch (err) {
      setError("Failed to load submission data");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitAnswer = async (questionId: string) => {
    const text = answerText[questionId];
    if (!text || !text.trim()) return;

    setIsSubmittingAnswer(questionId);

    try {
      const result = await apiClient.submitAnswer(submissionId, {
        question_id: questionId,
        answer_text: text,
      });

      if (result.error) {
        alert(`Failed to submit answer: ${result.error}`);
      } else {
        // Clear input and reload questions
        setAnswerText({ ...answerText, [questionId]: "" });
        const questionsResult = await apiClient.getAnswers(submissionId);
        if (questionsResult.data) {
          setQuestions(questionsResult.data.questions || []);
        }
      }
    } catch (err) {
      alert("Failed to submit answer");
      console.error(err);
    } finally {
      setIsSubmittingAnswer(null);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBadgeVariant = (score: number): "default" | "secondary" | "destructive" | "outline" => {
    if (score >= 80) return "default";
    if (score >= 60) return "secondary";
    return "destructive";
  };

  const getPriorityBadgeVariant = (priority: string): "default" | "secondary" | "destructive" | "outline" => {
    if (priority === "high") return "destructive";
    if (priority === "medium") return "secondary";
    return "outline";
  };

  const copyToClipboard = async (text: string, section: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(section);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (err) {
      toast.error("Failed to copy to clipboard");
      console.error("Copy failed:", err);
    }
  };

  const handleDownloadMainDocument = async () => {
    try {
      const result = await apiClient.downloadSubmissionFile(submissionId);
      if (result.data?.download_url) {
        // Open presigned URL in new tab to trigger download
        window.open(result.data.download_url, '_blank');
        toast.success(`Downloading ${result.data.file_name}`);
      } else {
        toast.error(result.error || "Failed to get download URL");
      }
    } catch (err) {
      toast.error("Failed to download file");
      console.error(err);
    }
  };

  const handleDownloadAppendix = async (appendixOrder: number, fileName: string) => {
    try {
      const result = await apiClient.downloadAppendix(submissionId, appendixOrder);
      if (result.data?.download_url) {
        // Open presigned URL in new tab to trigger download
        window.open(result.data.download_url, '_blank');
        toast.success(`Downloading ${fileName}`);
      } else {
        toast.error(result.error || "Failed to get download URL");
      }
    } catch (err) {
      toast.error("Failed to download appendix");
      console.error(err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-slate-600" />
          <p className="text-slate-600 dark:text-slate-400">Loading submission...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto p-6 max-w-7xl">
          <Button variant="ghost" onClick={() => router.back()} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto p-6 max-w-7xl">
          <Button variant="ghost" onClick={() => router.back()} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <p className="text-slate-600 dark:text-slate-400">Submission not found</p>
        </div>
      </div>
    );
  }

  return (
    <TextSelectionHandler>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" onClick={() => router.back()} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-50 mb-2">
                {submission.document_name}
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                Submitted on {new Date(submission.submitted_at).toLocaleString()}
              </p>
              <div className="flex gap-2">
                <Badge variant={getScoreBadgeVariant(submission.overall_score || 0)}>
                  {submission.status}
                </Badge>
                <Badge variant="outline">{submission.ai_analysis_status}</Badge>
              </div>
            </div>
            <Button onClick={loadSubmissionData} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Files Submitted Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Files Submitted
            </CardTitle>
            <CardDescription>
              {submission.appendix_files && submission.appendix_files.length > 0
                ? `Main document and ${submission.appendix_files.length} appendix${submission.appendix_files.length > 1 ? 'es' : ''}`
                : "Main document"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Main Document */}
            <div>
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                Main Document
              </h4>
              <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border-2 border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-3 flex-1">
                  <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {submission.document_name}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {submission.file_size ? `${(submission.file_size / 1024).toFixed(0)} KB` : 'Size unknown'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadMainDocument}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>

            {/* Appendices */}
            {submission.appendix_files && submission.appendix_files.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                  Appendices ({submission.appendix_files.length})
                </h4>
                <div className="space-y-2">
                  {submission.appendix_files.map((appendix: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <Paperclip className="h-5 w-5 text-slate-500" />
                        <div>
                          <p className="font-medium text-slate-900 dark:text-slate-100">
                            {appendix.file_name}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {(appendix.file_size / 1024).toFixed(0)} KB • Appendix {appendix.upload_order}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadAppendix(appendix.upload_order, appendix.file_name)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Analysis Status */}
        {submission.ai_analysis_status !== "completed" && (
          <Alert className="mb-6 border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
            <div className="flex items-start gap-3">
              <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <AlertTitle className="text-blue-900 dark:text-blue-100 mb-2">
                  {submission.ai_analysis_status === "in_progress"
                    ? "🤖 AI Analysis in Progress"
                    : submission.ai_analysis_status === "pending"
                    ? "⏳ Preparing Analysis"
                    : "Analysis Status"}
                </AlertTitle>
                <AlertDescription>
                  {submission.ai_analysis_status === "in_progress" ? (
                    <div className="space-y-2">
                      <p className="text-blue-800 dark:text-blue-200 font-medium">
                        6 AI agents are analyzing your document. This typically takes <strong>1-2 minutes</strong>.
                      </p>
                      <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full animate-pulse"></div>
                          <span>Auto-refreshing every 10 seconds</span>
                        </div>
                      </div>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                        You can safely close this page. Analysis will continue in the background.
                      </p>
                    </div>
                  ) : submission.ai_analysis_status === "pending" ? (
                    <div className="space-y-2">
                      <p className="text-blue-800 dark:text-blue-200">
                        Your document is queued for AI analysis. Starting shortly...
                      </p>
                      <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full animate-pulse"></div>
                          <span>Auto-refreshing every 10 seconds</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p>Analysis status: {submission.ai_analysis_status}</p>
                  )}
                </AlertDescription>
              </div>
            </div>
          </Alert>
        )}

        {/* Overall Score (if available) */}
        {feedback && feedback.overall_score !== null && (
          <Card className="mb-8 border-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl mb-2">Overall Analysis Score</CardTitle>
                  <CardDescription>AI-generated evaluation of your document</CardDescription>
                </div>
                <div className="text-center">
                  <div className={`text-6xl font-bold ${getScoreColor(feedback.overall_score)}`}>
                    {feedback.overall_score}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">out of 100</div>
                </div>
              </div>
            </CardHeader>
            {feedback.detailed_feedback && (
              <CardContent>
                <div className="relative">
                  <Alert variant="default">
                    <AlertDescription>{feedback.detailed_feedback}</AlertDescription>
                  </Alert>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(feedback.detailed_feedback, "overall")}
                    className="absolute top-2 right-2"
                  >
                    {copiedSection === "overall" ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Detailed Analysis */}
        {feedback && (
          <Tabs defaultValue="strengths" className="mb-8">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="strengths">
                Strengths ({feedback.strengths?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="weaknesses">
                Weaknesses ({feedback.weaknesses?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="recommendations">
                Recommendations ({feedback.recommendations?.length || 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="strengths">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                        Document Strengths
                      </CardTitle>
                      <CardDescription>Positive aspects identified by AI</CardDescription>
                    </div>
                    {feedback.strengths && feedback.strengths.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const text = feedback.strengths
                            .map((s: string, i: number) => `${i + 1}. ${s}`)
                            .join("\n");
                          copyToClipboard(text, "strengths");
                        }}
                      >
                        {copiedSection === "strengths" ? (
                          <>
                            <Check className="h-4 w-4 text-green-500 mr-2" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy All
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {feedback.strengths && feedback.strengths.length > 0 ? (
                    <ul className="space-y-3">
                      {feedback.strengths.map((strength: string, index: number) => (
                        <li key={index} className="flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                          <span className="text-slate-700 dark:text-slate-300">{strength}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate-600 dark:text-slate-400">No strengths identified</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="weaknesses">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingDown className="h-5 w-5 text-red-600" />
                        Document Weaknesses
                      </CardTitle>
                      <CardDescription>Issues requiring attention</CardDescription>
                    </div>
                    {feedback.weaknesses && feedback.weaknesses.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const text = feedback.weaknesses
                            .map((w: string, i: number) => `${i + 1}. ${w}`)
                            .join("\n");
                          copyToClipboard(text, "weaknesses");
                        }}
                      >
                        {copiedSection === "weaknesses" ? (
                          <>
                            <Check className="h-4 w-4 text-green-500 mr-2" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy All
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {feedback.weaknesses && feedback.weaknesses.length > 0 ? (
                    <ul className="space-y-3">
                      {feedback.weaknesses.map((weakness: string, index: number) => (
                        <li key={index} className="flex items-start gap-3">
                          <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                          <span className="text-slate-700 dark:text-slate-300">{weakness}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate-600 dark:text-slate-400">No weaknesses identified</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="recommendations">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>AI Recommendations</CardTitle>
                      <CardDescription>Actionable steps to improve the document</CardDescription>
                    </div>
                    {feedback.recommendations && feedback.recommendations.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const text = feedback.recommendations
                            .map((r: string, i: number) => `${i + 1}. ${r}`)
                            .join("\n");
                          copyToClipboard(text, "recommendations");
                        }}
                      >
                        {copiedSection === "recommendations" ? (
                          <>
                            <Check className="h-4 w-4 text-green-500 mr-2" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy All
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {feedback.recommendations && feedback.recommendations.length > 0 ? (
                    <ol className="space-y-4">
                      {feedback.recommendations.map((recommendation: string, index: number) => (
                        <li key={index} className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center text-sm font-semibold">
                            {index + 1}
                          </span>
                          <span className="text-slate-700 dark:text-slate-300 pt-0.5">
                            {recommendation}
                          </span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-slate-600 dark:text-slate-400">No recommendations available</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Clarification Questions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Clarification Questions ({questions.length})
            </CardTitle>
            <CardDescription>Questions from AI analysis that need your input</CardDescription>
          </CardHeader>
          <CardContent>
            {questions.length === 0 ? (
              <p className="text-slate-600 dark:text-slate-400">No questions available</p>
            ) : (
              <div className="space-y-6">
                {questions.map((question) => (
                  <div key={question.question_id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={getPriorityBadgeVariant(question.priority)}>
                            {question.priority}
                          </Badge>
                        </div>
                        <p className="font-medium text-slate-900 dark:text-slate-100 mb-2">
                          {question.question_text}
                        </p>
                      </div>
                    </div>

                    {/* Existing Answers */}
                    {question.answers && question.answers.length > 0 && (
                      <div className="mb-4 space-y-2">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Answers:</p>
                        {question.answers.map((answer) => (
                          <div key={answer.answer_id} className="bg-slate-50 dark:bg-slate-800 rounded p-3">
                            <p className="text-sm text-slate-700 dark:text-slate-300 mb-1">
                              {answer.answer_text}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-500">
                              by {answer.answered_by_name} on {new Date(answer.answered_at).toLocaleString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Answer Input */}
                    <div className="space-y-2">
                      <textarea
                        value={answerText[question.question_id] || ""}
                        onChange={(e) => setAnswerText({ ...answerText, [question.question_id]: e.target.value })}
                        placeholder="Type your answer here..."
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                        disabled={isSubmittingAnswer === question.question_id}
                      />
                      <Button
                        onClick={() => handleSubmitAnswer(question.question_id)}
                        disabled={isSubmittingAnswer === question.question_id || !answerText[question.question_id]?.trim()}
                        size="sm"
                      >
                        {isSubmittingAnswer === question.question_id ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          "Submit Answer"
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </div>
    </TextSelectionHandler>
  );
}
