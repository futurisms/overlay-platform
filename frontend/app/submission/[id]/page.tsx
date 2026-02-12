"use client";

import { useEffect, useState, useMemo } from "react";
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
  ChevronDown,
  FileSpreadsheet,
  Sparkles,
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
  const [isContentExpanded, setIsContentExpanded] = useState(false);
  const [mainDocumentText, setMainDocumentText] = useState<string>("");
  const [appendicesContent, setAppendicesContent] = useState<Array<{ fileName: string; text: string; uploadOrder: number }>>([]);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [annotation, setAnnotation] = useState<any>(null);
  const [isLoadingAnnotation, setIsLoadingAnnotation] = useState(false);
  const [hasAttemptedAnnotation, setHasAttemptedAnnotation] = useState(false);

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

  // Helper function to extract text from string or object with text property
  const extractText = (item: any): string => {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object' && 'text' in item) return item.text;
    return JSON.stringify(item);
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

  // Fetch submission content (main document + appendices text)
  const fetchContent = async () => {
    if (!submissionId || isLoadingContent) return;

    setIsLoadingContent(true);
    try {
      const response = await apiClient.getSubmissionContent(submissionId);

      if (response.error) {
        toast.error("Failed to load content", {
          description: response.error,
        });
      } else if (response.data) {
        setMainDocumentText(response.data.main_document.text);
        setAppendicesContent(response.data.appendices);
      }
    } catch (err) {
      toast.error("Failed to load content");
      console.error("Content fetch error:", err);
    } finally {
      setIsLoadingContent(false);
    }
  };

  // Fetch content when section is expanded (lazy loading)
  const handleToggleContent = () => {
    if (!isContentExpanded && mainDocumentText === "") {
      fetchContent();
    }
    setIsContentExpanded(!isContentExpanded);
  };

  // Copy all original submission content
  const handleCopyAll = async () => {
    if (!submission) return;

    let allContent = `ORIGINAL SUBMISSION\n${"=".repeat(80)}\n\n`;

    // Main document
    allContent += `MAIN DOCUMENT\n${"-".repeat(80)}\n`;
    allContent += `Document: ${submission.document_name}\n`;
    allContent += `Characters: ${mainDocumentText.length.toLocaleString()}\n\n`;
    allContent += `${mainDocumentText}\n\n`;

    // Appendices
    if (appendicesContent.length > 0) {
      appendicesContent.forEach((appendix: any, index: number) => {
        allContent += `${"=".repeat(80)}\n\n`;
        allContent += `APPENDIX ${index + 1}\n${"-".repeat(80)}\n`;
        allContent += `File: ${appendix.fileName}\n`;
        allContent += `Characters: ${appendix.text.length.toLocaleString()}\n\n`;
        allContent += `${appendix.text}\n\n`;
      });
    }

    await copyToClipboard(allContent, "original-all");
  };

  // Copy individual section
  const handleCopySection = async (sectionTitle: string, fileName: string, text: string, sectionId: string) => {
    const content = `${sectionTitle}\n${"-".repeat(80)}\n` +
                   `File: ${fileName}\n` +
                   `Characters: ${text.length.toLocaleString()}\n\n` +
                   `${text}`;
    await copyToClipboard(content, sectionId);
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

  const handleGenerateAnnotation = async () => {
    setIsLoadingAnnotation(true);
    setHasAttemptedAnnotation(true);

    const pollForAnnotation = async () => {
      try {
        const result = await apiClient.getSubmissionAnnotation(submissionId);

        if (result.status === 202 || (result.data && (result.data as any).status === 'generating')) {
          // Still generating, poll again in 3 seconds
          console.log('[Annotate] Status: generating, polling again in 3 seconds...');
          await new Promise(resolve => setTimeout(resolve, 3000));
          return pollForAnnotation(); // Recursive call to poll again
        }

        if (result.data && (result.data as any).status === 'completed') {
          // Generation complete
          setAnnotation(result.data);

          if ((result.data as any).cached) {
            toast.success("Loaded annotated document (cached)");
          } else {
            toast.success("Annotated document generated successfully!");
          }
          setIsLoadingAnnotation(false);
          return;
        }

        // If we get here, something went wrong
        toast.error(result.error || "Failed to generate annotation");
        setIsLoadingAnnotation(false);
      } catch (err: any) {
        console.error("Annotation error:", err);
        toast.error(err.message || "Failed to generate annotated document");
        setIsLoadingAnnotation(false);
      }
    };

    // Start polling
    await pollForAnnotation();
  };

  const copyAnnotatedDocument = async () => {
    if (!annotation?.annotated_json?.sections) return;

    const sections = annotation.annotated_json.sections;
    let output = "ANNOTATED DOCUMENT\n";
    output += "=".repeat(80) + "\n\n";

    sections.forEach((section: any, index: number) => {
      if (section.type === "text") {
        output += section.content + "\n\n";
      } else if (section.type === "annotations" && section.items) {
        output += "--- RECOMMENDATIONS & FEEDBACK ---\n";
        section.items.forEach((item: any, itemIndex: number) => {
          const prefix = item.priority === "high" ? "🔴" : item.priority === "medium" ? "🟡" : "🟢";
          output += `${prefix} [${item.type.toUpperCase()}] ${item.text}\n`;
        });
        output += "\n";
      }
    });

    output += "=".repeat(80) + "\n";
    output += `Generated: ${new Date(annotation.created_at).toLocaleString()}\n`;
    output += `Model: ${annotation.model_used}\n`;
    output += `Tokens: ${annotation.input_tokens} in, ${annotation.output_tokens} out\n`;

    try {
      await navigator.clipboard.writeText(output);
      toast.success("Annotated document copied to clipboard!");
      setCopiedSection("annotated");
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (err) {
      toast.error("Failed to copy to clipboard");
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

        {/* Original Submission Content */}
        <Card className="mb-8">
          <CardHeader
            className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            onClick={handleToggleContent}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle className="text-xl">Original Submission</CardTitle>
                <span className="px-2 py-0.5 text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded">
                  {1 + appendicesContent.length} {appendicesContent.length === 0 ? "document" : "documents"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyAll();
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy All
                </Button>
                <ChevronDown
                  className={`h-5 w-5 text-slate-500 transition-transform ${
                    isContentExpanded ? "rotate-180" : ""
                  }`}
                />
              </div>
            </div>
          </CardHeader>

          {isContentExpanded && (
            <CardContent className="space-y-6">
              {isLoadingContent ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
                    <p className="text-sm text-slate-500">Loading content...</p>
                  </div>
                </div>
              ) : (
                <>
              {/* Main Document */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                        Main Document
                      </h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {submission.document_name} • {mainDocumentText.length.toLocaleString()} characters
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleCopySection(
                          "MAIN DOCUMENT",
                          submission.document_name,
                          mainDocumentText,
                          "original-main"
                        )
                      }
                    >
                      {copiedSection === "original-main" ? (
                        <>
                          <Check className="h-4 w-4 mr-2 text-green-600" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                <div className="p-4 bg-white dark:bg-slate-900 max-h-[400px] overflow-y-auto">
                  <pre className="whitespace-pre-wrap font-mono text-sm text-slate-700 dark:text-slate-300">
                    {mainDocumentText}
                  </pre>
                </div>
              </div>

              {/* Appendices */}
              {appendicesContent.length > 0 &&
                appendicesContent.map((appendix: any, index: number) => (
                  <div
                    key={index}
                    className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden"
                  >
                    <div className="bg-slate-100 dark:bg-slate-800 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                            Appendix {index + 1}
                          </h4>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {appendix.fileName} • {appendix.text.length.toLocaleString()} characters
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleCopySection(
                              `APPENDIX ${index + 1}`,
                              appendix.fileName,
                              appendix.text,
                              `original-appendix-${index}`
                            )
                          }
                        >
                          {copiedSection === `original-appendix-${index}` ? (
                            <>
                              <Check className="h-4 w-4 mr-2 text-green-600" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4 mr-2" />
                              Copy
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="p-4 bg-white dark:bg-slate-900 max-h-[400px] overflow-y-auto">
                      <pre className="whitespace-pre-wrap font-mono text-sm text-slate-700 dark:text-slate-300">
                        {appendix.text}
                      </pre>
                    </div>
                  </div>
                ))}
                </>
              )}
            </CardContent>
          )}
        </Card>

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
                    <AlertDescription>
                      {typeof feedback.detailed_feedback === 'string'
                        ? feedback.detailed_feedback
                        : feedback.detailed_feedback.text || JSON.stringify(feedback.detailed_feedback)}
                    </AlertDescription>
                  </Alert>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(
                      typeof feedback.detailed_feedback === 'string'
                        ? feedback.detailed_feedback
                        : feedback.detailed_feedback.text || JSON.stringify(feedback.detailed_feedback),
                      "overall"
                    )}
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
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="strengths">
                Strengths ({feedback.strengths?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="weaknesses">
                Weaknesses ({feedback.weaknesses?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="recommendations">
                Recommendations ({feedback.recommendations?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="annotated" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Annotated Document
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
                            .map((s: any, i: number) => `${i + 1}. ${extractText(s)}`)
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
                      {feedback.strengths.map((strength: any, index: number) => (
                        <li key={index} className="flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                          <span className="text-slate-700 dark:text-slate-300">{extractText(strength)}</span>
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
                            .map((w: any, i: number) => `${i + 1}. ${extractText(w)}`)
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
                      {feedback.weaknesses.map((weakness: any, index: number) => (
                        <li key={index} className="flex items-start gap-3">
                          <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                          <span className="text-slate-700 dark:text-slate-300">{extractText(weakness)}</span>
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
                            .map((r: any, i: number) => `${i + 1}. ${extractText(r)}`)
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
                      {feedback.recommendations.map((recommendation: any, index: number) => (
                        <li key={index} className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center text-sm font-semibold">
                            {index + 1}
                          </span>
                          <span className="text-slate-700 dark:text-slate-300 pt-0.5">
                            {extractText(recommendation)}
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

            <TabsContent value="annotated">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-purple-600" />
                        Annotated Document
                      </CardTitle>
                      <CardDescription>
                        AI-generated document with recommendations woven into the original text
                      </CardDescription>
                    </div>
                    {annotation && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={copyAnnotatedDocument}
                        >
                          {copiedSection === "annotated" ? (
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
                        <Button
                          variant="outline"
                          size="sm"
                          disabled
                          className="opacity-50 cursor-not-allowed"
                          title="Coming soon in Task 6"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Export to Word
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {!hasAttemptedAnnotation && !annotation ? (
                    // Initial state: Show generate prompt
                    <div className="flex flex-col items-center justify-center py-12 px-6 text-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
                      <Sparkles className="h-12 w-12 text-purple-500 mb-4" />
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                        Generate Annotated Document
                      </h3>
                      <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md">
                        Create a sandwich-style document with AI recommendations interwoven into your original text.
                        This typically takes <strong>1-2 minutes</strong> to generate, depending on document length.
                      </p>
                      <Button
                        onClick={handleGenerateAnnotation}
                        disabled={isLoadingAnnotation}
                        size="lg"
                      >
                        {isLoadingAnnotation ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Generate Annotated Document
                          </>
                        )}
                      </Button>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-4">
                        Cost: ~$0.04 per generation • Results are cached
                      </p>
                    </div>
                  ) : isLoadingAnnotation ? (
                    // Loading state
                    <div className="flex flex-col items-center justify-center py-12 px-6">
                      <Loader2 className="h-12 w-12 text-purple-600 animate-spin mb-4" />
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                        Generating Annotated Document...
                      </h3>
                      <p className="text-slate-600 dark:text-slate-400 text-center max-w-md">
                        AI is analyzing your document and weaving recommendations into the text.
                        This typically takes 1-2 minutes, depending on document length.
                      </p>
                      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mt-4">
                        <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse"></div>
                        <span>Processing with Claude Sonnet 4.5...</span>
                      </div>
                    </div>
                  ) : annotation ? (
                    // Render annotated document
                    <div className="space-y-6">
                      {/* Sections */}
                      <div className="space-y-6">
                        {annotation.annotated_json.sections.map((section: any, index: number) => {
                          if (section.type === "text") {
                            return (
                              <div
                                key={index}
                                className="prose prose-slate dark:prose-invert max-w-none"
                              >
                                <div className="whitespace-pre-wrap text-slate-700 dark:text-slate-300 leading-relaxed">
                                  {section.content}
                                </div>
                              </div>
                            );
                          } else if (section.type === "annotations") {
                            return (
                              <div key={index} className="space-y-3 my-8">
                                {section.items.map((item: any, itemIndex: number) => {
                                  const priorityColors = {
                                    high: {
                                      border: "border-l-red-500",
                                      bg: "bg-red-50 dark:bg-red-950/20",
                                      badge: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
                                    },
                                    medium: {
                                      border: "border-l-orange-500",
                                      bg: "bg-orange-50 dark:bg-orange-950/20",
                                      badge: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
                                    },
                                    low: {
                                      border: "border-l-green-500",
                                      bg: "bg-green-50 dark:bg-green-950/20",
                                      badge: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
                                    },
                                  };

                                  const colors = priorityColors[item.priority as keyof typeof priorityColors];

                                  return (
                                    <div
                                      key={itemIndex}
                                      className={`border-l-4 ${colors.border} ${colors.bg} p-4 rounded-r-lg`}
                                    >
                                      <div className="flex items-center gap-2 mb-2">
                                        <Badge
                                          variant="secondary"
                                          className={`${colors.badge} text-xs font-bold uppercase`}
                                        >
                                          {item.priority}
                                        </Badge>
                                        <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">
                                          {item.type}
                                        </span>
                                      </div>
                                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                                        {item.text}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>

                      {/* Metadata footer */}
                      <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-8">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold mb-1">
                              Generated
                            </p>
                            <p className="text-slate-700 dark:text-slate-300">
                              {new Date(annotation.created_at).toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold mb-1">
                              Model
                            </p>
                            <p className="text-slate-700 dark:text-slate-300 font-mono text-xs">
                              {annotation.model_used.replace("claude-", "")}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold mb-1">
                              Tokens
                            </p>
                            <p className="text-slate-700 dark:text-slate-300">
                              {annotation.input_tokens.toLocaleString()} in • {annotation.output_tokens.toLocaleString()} out
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold mb-1">
                              Generation Time
                            </p>
                            <p className="text-slate-700 dark:text-slate-300">
                              {(annotation.generation_time_ms / 1000).toFixed(1)}s
                              {annotation.cached && (
                                <Badge variant="secondary" className="ml-2 text-xs">
                                  Cached
                                </Badge>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Error state
                    <div className="text-center py-8">
                      <p className="text-slate-600 dark:text-slate-400">
                        Failed to load annotated document. Please try again.
                      </p>
                      <Button
                        onClick={handleGenerateAnnotation}
                        variant="outline"
                        className="mt-4"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Retry
                      </Button>
                    </div>
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
