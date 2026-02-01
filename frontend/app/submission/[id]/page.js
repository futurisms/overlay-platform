"use client";
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = SubmissionPage;
const react_1 = require("react");
const navigation_1 = require("next/navigation");
const card_1 = require("@/components/ui/card");
const button_1 = require("@/components/ui/button");
const badge_1 = require("@/components/ui/badge");
const alert_1 = require("@/components/ui/alert");
const tabs_1 = require("@/components/ui/tabs");
const lucide_react_1 = require("lucide-react");
const api_client_1 = require("@/lib/api-client");
const auth_1 = require("@/lib/auth");
const sonner_1 = require("sonner");
const TextSelectionHandler_1 = require("@/components/TextSelectionHandler");
function SubmissionPage() {
    const router = (0, navigation_1.useRouter)();
    const params = (0, navigation_1.useParams)();
    const submissionId = params?.id;
    const [submission, setSubmission] = (0, react_1.useState)(null);
    const [feedback, setFeedback] = (0, react_1.useState)(null);
    const [questions, setQuestions] = (0, react_1.useState)([]);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)(null);
    const [answerText, setAnswerText] = (0, react_1.useState)({});
    const [isSubmittingAnswer, setIsSubmittingAnswer] = (0, react_1.useState)(null);
    const [copiedSection, setCopiedSection] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        // Check authentication
        const currentUser = (0, auth_1.getCurrentUser)();
        if (!currentUser) {
            router.push("/login");
            return;
        }
        if (submissionId) {
            loadSubmissionData();
        }
    }, [submissionId, router]);
    // Auto-refresh when analysis is in progress
    (0, react_1.useEffect)(() => {
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
                api_client_1.apiClient.getSubmission(submissionId),
                api_client_1.apiClient.getSubmissionFeedback(submissionId),
                api_client_1.apiClient.getAnswers(submissionId),
            ]);
            if (submissionResult.error) {
                setError(submissionResult.error);
            }
            else if (submissionResult.data) {
                setSubmission(submissionResult.data);
            }
            if (feedbackResult.data) {
                setFeedback(feedbackResult.data);
            }
            if (questionsResult.data) {
                setQuestions(questionsResult.data.questions || []);
            }
        }
        catch (err) {
            setError("Failed to load submission data");
            console.error(err);
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleSubmitAnswer = async (questionId) => {
        const text = answerText[questionId];
        if (!text || !text.trim())
            return;
        setIsSubmittingAnswer(questionId);
        try {
            const result = await api_client_1.apiClient.submitAnswer(submissionId, {
                question_id: questionId,
                answer_text: text,
            });
            if (result.error) {
                alert(`Failed to submit answer: ${result.error}`);
            }
            else {
                // Clear input and reload questions
                setAnswerText({ ...answerText, [questionId]: "" });
                const questionsResult = await api_client_1.apiClient.getAnswers(submissionId);
                if (questionsResult.data) {
                    setQuestions(questionsResult.data.questions || []);
                }
            }
        }
        catch (err) {
            alert("Failed to submit answer");
            console.error(err);
        }
        finally {
            setIsSubmittingAnswer(null);
        }
    };
    const getScoreColor = (score) => {
        if (score >= 80)
            return "text-green-600";
        if (score >= 60)
            return "text-yellow-600";
        return "text-red-600";
    };
    const getScoreBadgeVariant = (score) => {
        if (score >= 80)
            return "default";
        if (score >= 60)
            return "secondary";
        return "destructive";
    };
    const getPriorityBadgeVariant = (priority) => {
        if (priority === "high")
            return "destructive";
        if (priority === "medium")
            return "secondary";
        return "outline";
    };
    const copyToClipboard = async (text, section) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedSection(section);
            sonner_1.toast.success("Copied to clipboard!");
            setTimeout(() => setCopiedSection(null), 2000);
        }
        catch (err) {
            sonner_1.toast.error("Failed to copy to clipboard");
            console.error("Copy failed:", err);
        }
    };
    const handleDownloadMainDocument = async () => {
        try {
            const result = await api_client_1.apiClient.downloadSubmissionFile(submissionId);
            if (result.data?.download_url) {
                // Open presigned URL in new tab to trigger download
                window.open(result.data.download_url, '_blank');
                sonner_1.toast.success(`Downloading ${result.data.file_name}`);
            }
            else {
                sonner_1.toast.error(result.error || "Failed to get download URL");
            }
        }
        catch (err) {
            sonner_1.toast.error("Failed to download file");
            console.error(err);
        }
    };
    const handleDownloadAppendix = async (appendixOrder, fileName) => {
        try {
            const result = await api_client_1.apiClient.downloadAppendix(submissionId, appendixOrder);
            if (result.data?.download_url) {
                // Open presigned URL in new tab to trigger download
                window.open(result.data.download_url, '_blank');
                sonner_1.toast.success(`Downloading ${fileName}`);
            }
            else {
                sonner_1.toast.error(result.error || "Failed to get download URL");
            }
        }
        catch (err) {
            sonner_1.toast.error("Failed to download appendix");
            console.error(err);
        }
    };
    if (isLoading) {
        return (<div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <lucide_react_1.Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-slate-600"/>
          <p className="text-slate-600 dark:text-slate-400">Loading submission...</p>
        </div>
      </div>);
    }
    if (error) {
        return (<div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto p-6 max-w-7xl">
          <button_1.Button variant="ghost" onClick={() => router.back()} className="mb-4">
            <lucide_react_1.ArrowLeft className="mr-2 h-4 w-4"/>
            Back
          </button_1.Button>
          <alert_1.Alert variant="destructive">
            <alert_1.AlertDescription>{error}</alert_1.AlertDescription>
          </alert_1.Alert>
        </div>
      </div>);
    }
    if (!submission) {
        return (<div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto p-6 max-w-7xl">
          <button_1.Button variant="ghost" onClick={() => router.back()} className="mb-4">
            <lucide_react_1.ArrowLeft className="mr-2 h-4 w-4"/>
            Back
          </button_1.Button>
          <p className="text-slate-600 dark:text-slate-400">Submission not found</p>
        </div>
      </div>);
    }
    return (<TextSelectionHandler_1.TextSelectionHandler>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <button_1.Button variant="ghost" onClick={() => router.back()} className="mb-4">
            <lucide_react_1.ArrowLeft className="mr-2 h-4 w-4"/>
            Back
          </button_1.Button>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-50 mb-2">
                {submission.document_name}
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                Submitted on {new Date(submission.submitted_at).toLocaleString()}
              </p>
              <div className="flex gap-2">
                <badge_1.Badge variant={getScoreBadgeVariant(submission.overall_score || 0)}>
                  {submission.status}
                </badge_1.Badge>
                <badge_1.Badge variant="outline">{submission.ai_analysis_status}</badge_1.Badge>
              </div>
            </div>
            <button_1.Button onClick={loadSubmissionData} variant="outline">
              <lucide_react_1.RefreshCw className="mr-2 h-4 w-4"/>
              Refresh
            </button_1.Button>
          </div>
        </div>

        {/* Files Submitted Section */}
        <card_1.Card className="mb-6">
          <card_1.CardHeader>
            <card_1.CardTitle className="flex items-center gap-2">
              <lucide_react_1.FileText className="h-5 w-5"/>
              Files Submitted
            </card_1.CardTitle>
            <card_1.CardDescription>
              {submission.appendix_files && submission.appendix_files.length > 0
            ? `Main document and ${submission.appendix_files.length} appendix${submission.appendix_files.length > 1 ? 'es' : ''}`
            : "Main document"}
            </card_1.CardDescription>
          </card_1.CardHeader>
          <card_1.CardContent className="space-y-6">
            {/* Main Document */}
            <div>
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                Main Document
              </h4>
              <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border-2 border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-3 flex-1">
                  <lucide_react_1.FileText className="h-5 w-5 text-blue-600 dark:text-blue-400"/>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {submission.document_name}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {submission.file_size ? `${(submission.file_size / 1024).toFixed(0)} KB` : 'Size unknown'}
                    </p>
                  </div>
                </div>
                <button_1.Button variant="outline" size="sm" onClick={handleDownloadMainDocument}>
                  <lucide_react_1.Download className="h-4 w-4 mr-2"/>
                  Download
                </button_1.Button>
              </div>
            </div>

            {/* Appendices */}
            {submission.appendix_files && submission.appendix_files.length > 0 && (<div>
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                  Appendices ({submission.appendix_files.length})
                </h4>
                <div className="space-y-2">
                  {submission.appendix_files.map((appendix, index) => (<div key={index} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-3 flex-1">
                        <lucide_react_1.Paperclip className="h-5 w-5 text-slate-500"/>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-slate-100">
                            {appendix.file_name}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {(appendix.file_size / 1024).toFixed(0)} KB • Appendix {appendix.upload_order}
                          </p>
                        </div>
                      </div>
                      <button_1.Button variant="outline" size="sm" onClick={() => handleDownloadAppendix(appendix.upload_order, appendix.file_name)}>
                        <lucide_react_1.Download className="h-4 w-4 mr-2"/>
                        Download
                      </button_1.Button>
                    </div>))}
                </div>
              </div>)}
          </card_1.CardContent>
        </card_1.Card>

        {/* AI Analysis Status */}
        {submission.ai_analysis_status !== "completed" && (<alert_1.Alert className="mb-6 border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
            <div className="flex items-start gap-3">
              <lucide_react_1.Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin mt-0.5 flex-shrink-0"/>
              <div className="flex-1">
                <alert_1.AlertTitle className="text-blue-900 dark:text-blue-100 mb-2">
                  {submission.ai_analysis_status === "in_progress"
                ? "🤖 AI Analysis in Progress"
                : submission.ai_analysis_status === "pending"
                    ? "⏳ Preparing Analysis"
                    : "Analysis Status"}
                </alert_1.AlertTitle>
                <alert_1.AlertDescription>
                  {submission.ai_analysis_status === "in_progress" ? (<div className="space-y-2">
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
                    </div>) : submission.ai_analysis_status === "pending" ? (<div className="space-y-2">
                      <p className="text-blue-800 dark:text-blue-200">
                        Your document is queued for AI analysis. Starting shortly...
                      </p>
                      <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full animate-pulse"></div>
                          <span>Auto-refreshing every 10 seconds</span>
                        </div>
                      </div>
                    </div>) : (<p>Analysis status: {submission.ai_analysis_status}</p>)}
                </alert_1.AlertDescription>
              </div>
            </div>
          </alert_1.Alert>)}

        {/* Overall Score (if available) */}
        {feedback && feedback.overall_score !== null && (<card_1.Card className="mb-8 border-2">
            <card_1.CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <card_1.CardTitle className="text-2xl mb-2">Overall Analysis Score</card_1.CardTitle>
                  <card_1.CardDescription>AI-generated evaluation of your document</card_1.CardDescription>
                </div>
                <div className="text-center">
                  <div className={`text-6xl font-bold ${getScoreColor(feedback.overall_score)}`}>
                    {feedback.overall_score}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">out of 100</div>
                </div>
              </div>
            </card_1.CardHeader>
            {feedback.detailed_feedback && (<card_1.CardContent>
                <div className="relative">
                  <alert_1.Alert variant="default">
                    <alert_1.AlertDescription>{feedback.detailed_feedback}</alert_1.AlertDescription>
                  </alert_1.Alert>
                  <button_1.Button variant="ghost" size="sm" onClick={() => copyToClipboard(feedback.detailed_feedback, "overall")} className="absolute top-2 right-2">
                    {copiedSection === "overall" ? (<lucide_react_1.Check className="h-4 w-4 text-green-500"/>) : (<lucide_react_1.Copy className="h-4 w-4"/>)}
                  </button_1.Button>
                </div>
              </card_1.CardContent>)}
          </card_1.Card>)}

        {/* Detailed Analysis */}
        {feedback && (<tabs_1.Tabs defaultValue="strengths" className="mb-8">
            <tabs_1.TabsList className="grid w-full grid-cols-3">
              <tabs_1.TabsTrigger value="strengths">
                Strengths ({feedback.strengths?.length || 0})
              </tabs_1.TabsTrigger>
              <tabs_1.TabsTrigger value="weaknesses">
                Weaknesses ({feedback.weaknesses?.length || 0})
              </tabs_1.TabsTrigger>
              <tabs_1.TabsTrigger value="recommendations">
                Recommendations ({feedback.recommendations?.length || 0})
              </tabs_1.TabsTrigger>
            </tabs_1.TabsList>

            <tabs_1.TabsContent value="strengths">
              <card_1.Card>
                <card_1.CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <card_1.CardTitle className="flex items-center gap-2">
                        <lucide_react_1.TrendingUp className="h-5 w-5 text-green-600"/>
                        Document Strengths
                      </card_1.CardTitle>
                      <card_1.CardDescription>Positive aspects identified by AI</card_1.CardDescription>
                    </div>
                    {feedback.strengths && feedback.strengths.length > 0 && (<button_1.Button variant="ghost" size="sm" onClick={() => {
                    const text = feedback.strengths
                        .map((s, i) => `${i + 1}. ${s}`)
                        .join("\n");
                    copyToClipboard(text, "strengths");
                }}>
                        {copiedSection === "strengths" ? (<>
                            <lucide_react_1.Check className="h-4 w-4 text-green-500 mr-2"/>
                            Copied
                          </>) : (<>
                            <lucide_react_1.Copy className="h-4 w-4 mr-2"/>
                            Copy All
                          </>)}
                      </button_1.Button>)}
                  </div>
                </card_1.CardHeader>
                <card_1.CardContent>
                  {feedback.strengths && feedback.strengths.length > 0 ? (<ul className="space-y-3">
                      {feedback.strengths.map((strength, index) => (<li key={index} className="flex items-start gap-3">
                          <lucide_react_1.CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0"/>
                          <span className="text-slate-700 dark:text-slate-300">{strength}</span>
                        </li>))}
                    </ul>) : (<p className="text-slate-600 dark:text-slate-400">No strengths identified</p>)}
                </card_1.CardContent>
              </card_1.Card>
            </tabs_1.TabsContent>

            <tabs_1.TabsContent value="weaknesses">
              <card_1.Card>
                <card_1.CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <card_1.CardTitle className="flex items-center gap-2">
                        <lucide_react_1.TrendingDown className="h-5 w-5 text-red-600"/>
                        Document Weaknesses
                      </card_1.CardTitle>
                      <card_1.CardDescription>Issues requiring attention</card_1.CardDescription>
                    </div>
                    {feedback.weaknesses && feedback.weaknesses.length > 0 && (<button_1.Button variant="ghost" size="sm" onClick={() => {
                    const text = feedback.weaknesses
                        .map((w, i) => `${i + 1}. ${w}`)
                        .join("\n");
                    copyToClipboard(text, "weaknesses");
                }}>
                        {copiedSection === "weaknesses" ? (<>
                            <lucide_react_1.Check className="h-4 w-4 text-green-500 mr-2"/>
                            Copied
                          </>) : (<>
                            <lucide_react_1.Copy className="h-4 w-4 mr-2"/>
                            Copy All
                          </>)}
                      </button_1.Button>)}
                  </div>
                </card_1.CardHeader>
                <card_1.CardContent>
                  {feedback.weaknesses && feedback.weaknesses.length > 0 ? (<ul className="space-y-3">
                      {feedback.weaknesses.map((weakness, index) => (<li key={index} className="flex items-start gap-3">
                          <lucide_react_1.XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0"/>
                          <span className="text-slate-700 dark:text-slate-300">{weakness}</span>
                        </li>))}
                    </ul>) : (<p className="text-slate-600 dark:text-slate-400">No weaknesses identified</p>)}
                </card_1.CardContent>
              </card_1.Card>
            </tabs_1.TabsContent>

            <tabs_1.TabsContent value="recommendations">
              <card_1.Card>
                <card_1.CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <card_1.CardTitle>AI Recommendations</card_1.CardTitle>
                      <card_1.CardDescription>Actionable steps to improve the document</card_1.CardDescription>
                    </div>
                    {feedback.recommendations && feedback.recommendations.length > 0 && (<button_1.Button variant="ghost" size="sm" onClick={() => {
                    const text = feedback.recommendations
                        .map((r, i) => `${i + 1}. ${r}`)
                        .join("\n");
                    copyToClipboard(text, "recommendations");
                }}>
                        {copiedSection === "recommendations" ? (<>
                            <lucide_react_1.Check className="h-4 w-4 text-green-500 mr-2"/>
                            Copied
                          </>) : (<>
                            <lucide_react_1.Copy className="h-4 w-4 mr-2"/>
                            Copy All
                          </>)}
                      </button_1.Button>)}
                  </div>
                </card_1.CardHeader>
                <card_1.CardContent>
                  {feedback.recommendations && feedback.recommendations.length > 0 ? (<ol className="space-y-4">
                      {feedback.recommendations.map((recommendation, index) => (<li key={index} className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center text-sm font-semibold">
                            {index + 1}
                          </span>
                          <span className="text-slate-700 dark:text-slate-300 pt-0.5">
                            {recommendation}
                          </span>
                        </li>))}
                    </ol>) : (<p className="text-slate-600 dark:text-slate-400">No recommendations available</p>)}
                </card_1.CardContent>
              </card_1.Card>
            </tabs_1.TabsContent>
          </tabs_1.Tabs>)}

        {/* Clarification Questions */}
        <card_1.Card>
          <card_1.CardHeader>
            <card_1.CardTitle className="flex items-center gap-2">
              <lucide_react_1.MessageSquare className="h-5 w-5"/>
              Clarification Questions ({questions.length})
            </card_1.CardTitle>
            <card_1.CardDescription>Questions from AI analysis that need your input</card_1.CardDescription>
          </card_1.CardHeader>
          <card_1.CardContent>
            {questions.length === 0 ? (<p className="text-slate-600 dark:text-slate-400">No questions available</p>) : (<div className="space-y-6">
                {questions.map((question) => (<div key={question.question_id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <badge_1.Badge variant={getPriorityBadgeVariant(question.priority)}>
                            {question.priority}
                          </badge_1.Badge>
                        </div>
                        <p className="font-medium text-slate-900 dark:text-slate-100 mb-2">
                          {question.question_text}
                        </p>
                      </div>
                    </div>

                    {/* Existing Answers */}
                    {question.answers && question.answers.length > 0 && (<div className="mb-4 space-y-2">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Answers:</p>
                        {question.answers.map((answer) => (<div key={answer.answer_id} className="bg-slate-50 dark:bg-slate-800 rounded p-3">
                            <p className="text-sm text-slate-700 dark:text-slate-300 mb-1">
                              {answer.answer_text}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-500">
                              by {answer.answered_by_name} on {new Date(answer.answered_at).toLocaleString()}
                            </p>
                          </div>))}
                      </div>)}

                    {/* Answer Input */}
                    <div className="space-y-2">
                      <textarea value={answerText[question.question_id] || ""} onChange={(e) => setAnswerText({ ...answerText, [question.question_id]: e.target.value })} placeholder="Type your answer here..." className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]" disabled={isSubmittingAnswer === question.question_id}/>
                      <button_1.Button onClick={() => handleSubmitAnswer(question.question_id)} disabled={isSubmittingAnswer === question.question_id || !answerText[question.question_id]?.trim()} size="sm">
                        {isSubmittingAnswer === question.question_id ? (<>
                            <lucide_react_1.Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                            Submitting...
                          </>) : ("Submit Answer")}
                      </button_1.Button>
                    </div>
                  </div>))}
              </div>)}
          </card_1.CardContent>
        </card_1.Card>
        </div>
      </div>
    </TextSelectionHandler_1.TextSelectionHandler>);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFnZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInBhZ2UudHN4Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFlBQVksQ0FBQzs7O0FBK0NiLGlDQWlxQkM7QUE5c0JELGlDQUE0QztBQUM1QyxnREFBdUQ7QUFDdkQsK0NBQWlHO0FBQ2pHLG1EQUFnRDtBQUNoRCxpREFBOEM7QUFDOUMsaURBQTRFO0FBRTVFLCtDQUFnRjtBQUdoRiwrQ0FnQnNCO0FBQ3RCLGlEQUE2QztBQUM3QyxxQ0FBNEM7QUFDNUMsbUNBQStCO0FBQy9CLDRFQUF5RTtBQWV6RSxTQUF3QixjQUFjO0lBQ3BDLE1BQU0sTUFBTSxHQUFHLElBQUEsc0JBQVMsR0FBRSxDQUFDO0lBQzNCLE1BQU0sTUFBTSxHQUFHLElBQUEsc0JBQVMsR0FBRSxDQUFDO0lBQzNCLE1BQU0sWUFBWSxHQUFHLE1BQU0sRUFBRSxFQUFZLENBQUM7SUFFMUMsTUFBTSxDQUFDLFVBQVUsRUFBRSxhQUFhLENBQUMsR0FBRyxJQUFBLGdCQUFRLEVBQU0sSUFBSSxDQUFDLENBQUM7SUFDeEQsTUFBTSxDQUFDLFFBQVEsRUFBRSxXQUFXLENBQUMsR0FBRyxJQUFBLGdCQUFRLEVBQU0sSUFBSSxDQUFDLENBQUM7SUFDcEQsTUFBTSxDQUFDLFNBQVMsRUFBRSxZQUFZLENBQUMsR0FBRyxJQUFBLGdCQUFRLEVBQWEsRUFBRSxDQUFDLENBQUM7SUFDM0QsTUFBTSxDQUFDLFNBQVMsRUFBRSxZQUFZLENBQUMsR0FBRyxJQUFBLGdCQUFRLEVBQUMsSUFBSSxDQUFDLENBQUM7SUFDakQsTUFBTSxDQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsR0FBRyxJQUFBLGdCQUFRLEVBQWdCLElBQUksQ0FBQyxDQUFDO0lBQ3hELE1BQU0sQ0FBQyxVQUFVLEVBQUUsYUFBYSxDQUFDLEdBQUcsSUFBQSxnQkFBUSxFQUE0QixFQUFFLENBQUMsQ0FBQztJQUM1RSxNQUFNLENBQUMsa0JBQWtCLEVBQUUscUJBQXFCLENBQUMsR0FB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QUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQzFGLFdBQVcsQ0FBQywwQkFBMEIsQ0FDdEMsU0FBUyxDQUFDLDBNQUEwTSxDQUNwTixRQUFRLENBQUMsQ0FBQyxrQkFBa0IsS0FBSyxRQUFRLENBQUMsV0FBVyxDQUFDLEVBRXhEO3NCQUFBLENBQUMsZUFBTSxDQUNMLE9BQU8sQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLGtCQUFrQixDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUN4RCxRQUFRLENBQUMsQ0FBQyxrQkFBa0IsS0FBSyxRQUFRLENBQUMsV0FBVyxJQUFJLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUNuRyxJQUFJLENBQUMsSUFBSSxDQUVUO3dCQUFBLENBQUMsa0JBQWtCLEtBQUssUUFBUSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FDN0MsRUFDRTs0QkFBQSxDQUFDLHNCQUFPLENBQUMsU0FBUyxDQUFDLDJCQUEyQixFQUM5Qzs7MEJBQ0YsR0FBRyxDQUNKLENBQUMsQ0FBQyxDQUFDLENBQ0YsZUFBZSxDQUNoQixDQUNIO3NCQUFBLEVBQUUsZUFBTSxDQUNWO29CQUFBLEVBQUUsR0FBRyxDQUNQO2tCQUFBLEVBQUUsR0FBRyxDQUFDLENBQ1AsQ0FBQyxDQUNKO2NBQUEsRUFBRSxHQUFHLENBQUMsQ0FDUCxDQUNIO1VBQUEsRUFBRSxrQkFBVyxDQUNmO1FBQUEsRUFBRSxXQUFJLENBQ047UUFBQSxFQUFFLEdBQUcsQ0FDUDtNQUFBLEVBQUUsR0FBRyxDQUNQO0lBQUEsRUFBRSwyQ0FBb0IsQ0FBQyxDQUN4QixDQUFDO0FBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIlwidXNlIGNsaWVudFwiO1xuXG5pbXBvcnQgeyB1c2VFZmZlY3QsIHVzZVN0YXRlIH0gZnJvbSBcInJlYWN0XCI7XG5pbXBvcnQgeyB1c2VSb3V0ZXIsIHVzZVBhcmFtcyB9IGZyb20gXCJuZXh0L25hdmlnYXRpb25cIjtcbmltcG9ydCB7IENhcmQsIENhcmRDb250ZW50LCBDYXJkRGVzY3JpcHRpb24sIENhcmRIZWFkZXIsIENhcmRUaXRsZSB9IGZyb20gXCJAL2NvbXBvbmVudHMvdWkvY2FyZFwiO1xuaW1wb3J0IHsgQnV0dG9uIH0gZnJvbSBcIkAvY29tcG9uZW50cy91aS9idXR0b25cIjtcbmltcG9ydCB7IEJhZGdlIH0gZnJvbSBcIkAvY29tcG9uZW50cy91aS9iYWRnZVwiO1xuaW1wb3J0IHsgQWxlcnQsIEFsZXJ0RGVzY3JpcHRpb24sIEFsZXJ0VGl0bGUgfSBmcm9tIFwiQC9jb21wb25lbnRzL3VpL2FsZXJ0XCI7XG5pbXBvcnQgeyBQcm9ncmVzcyB9IGZyb20gXCJAL2NvbXBvbmVudHMvdWkvcHJvZ3Jlc3NcIjtcbmltcG9ydCB7IFRhYnMsIFRhYnNDb250ZW50LCBUYWJzTGlzdCwgVGFic1RyaWdnZXIgfSBmcm9tIFwiQC9jb21wb25lbnRzL3VpL3RhYnNcIjtcbmltcG9ydCB7IFNlcGFyYXRvciB9IGZyb20gXCJAL2NvbXBvbmVudHMvdWkvc2VwYXJhdG9yXCI7XG5pbXBvcnQgeyBTY3JvbGxBcmVhIH0gZnJvbSBcIkAvY29tcG9uZW50cy91aS9zY3JvbGwtYXJlYVwiO1xuaW1wb3J0IHtcbiAgTG9hZGVyMixcbiAgQXJyb3dMZWZ0LFxuICBGaWxlVGV4dCxcbiAgQ2hlY2tDaXJjbGUyLFxuICBYQ2lyY2xlLFxuICBUcmVuZGluZ1VwLFxuICBUcmVuZGluZ0Rvd24sXG4gIE1lc3NhZ2VTcXVhcmUsXG4gIEFsZXJ0Q2lyY2xlLFxuICBBbGVydFRyaWFuZ2xlLFxuICBSZWZyZXNoQ3csXG4gIENvcHksXG4gIENoZWNrLFxuICBQYXBlcmNsaXAsXG4gIERvd25sb2FkLFxufSBmcm9tIFwibHVjaWRlLXJlYWN0XCI7XG5pbXBvcnQgeyBhcGlDbGllbnQgfSBmcm9tIFwiQC9saWIvYXBpLWNsaWVudFwiO1xuaW1wb3J0IHsgZ2V0Q3VycmVudFVzZXIgfSBmcm9tIFwiQC9saWIvYXV0aFwiO1xuaW1wb3J0IHsgdG9hc3QgfSBmcm9tIFwic29ubmVyXCI7XG5pbXBvcnQgeyBUZXh0U2VsZWN0aW9uSGFuZGxlciB9IGZyb20gXCJAL2NvbXBvbmVudHMvVGV4dFNlbGVjdGlvbkhhbmRsZXJcIjtcblxuaW50ZXJmYWNlIFF1ZXN0aW9uIHtcbiAgcXVlc3Rpb25faWQ6IHN0cmluZztcbiAgcXVlc3Rpb25fdGV4dDogc3RyaW5nO1xuICBwcmlvcml0eTogc3RyaW5nO1xuICBjcmVhdGVkX2F0OiBzdHJpbmc7XG4gIGFuc3dlcnM6IEFycmF5PHtcbiAgICBhbnN3ZXJfaWQ6IHN0cmluZztcbiAgICBhbnN3ZXJfdGV4dDogc3RyaW5nO1xuICAgIGFuc3dlcmVkX2J5X25hbWU6IHN0cmluZztcbiAgICBhbnN3ZXJlZF9hdDogc3RyaW5nO1xuICB9Pjtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gU3VibWlzc2lvblBhZ2UoKSB7XG4gIGNvbnN0IHJvdXRlciA9IHVzZVJvdXRlcigpO1xuICBjb25zdCBwYXJhbXMgPSB1c2VQYXJhbXMoKTtcbiAgY29uc3Qgc3VibWlzc2lvbklkID0gcGFyYW1zPy5pZCBhcyBzdHJpbmc7XG5cbiAgY29uc3QgW3N1Ym1pc3Npb24sIHNldFN1Ym1pc3Npb25dID0gdXNlU3RhdGU8YW55PihudWxsKTtcbiAgY29uc3QgW2ZlZWRiYWNrLCBzZXRGZWVkYmFja10gPSB1c2VTdGF0ZTxhbnk+KG51bGwpO1xuICBjb25zdCBbcXVlc3Rpb25zLCBzZXRRdWVzdGlvbnNdID0gdXNlU3RhdGU8UXVlc3Rpb25bXT4oW10pO1xuICBjb25zdCBbaXNMb2FkaW5nLCBzZXRJc0xvYWRpbmddID0gdXNlU3RhdGUodHJ1ZSk7XG4gIGNvbnN0IFtlcnJvciwgc2V0RXJyb3JdID0gdXNlU3RhdGU8c3RyaW5nIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFthbnN3ZXJUZXh0LCBzZXRBbnN3ZXJUZXh0XSA9IHVzZVN0YXRlPHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0+KHt9KTtcbiAgY29uc3QgW2lzU3VibWl0dGluZ0Fuc3dlciwgc2V0SXNTdWJtaXR0aW5nQW5zd2VyXSA9IHVzZVN0YXRlPHN0cmluZyB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbY29waWVkU2VjdGlvbiwgc2V0Q29waWVkU2VjdGlvbl0gPSB1c2VTdGF0ZTxzdHJpbmcgfCBudWxsPihudWxsKTtcblxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIC8vIENoZWNrIGF1dGhlbnRpY2F0aW9uXG4gICAgY29uc3QgY3VycmVudFVzZXIgPSBnZXRDdXJyZW50VXNlcigpO1xuICAgIGlmICghY3VycmVudFVzZXIpIHtcbiAgICAgIHJvdXRlci5wdXNoKFwiL2xvZ2luXCIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChzdWJtaXNzaW9uSWQpIHtcbiAgICAgIGxvYWRTdWJtaXNzaW9uRGF0YSgpO1xuICAgIH1cbiAgfSwgW3N1Ym1pc3Npb25JZCwgcm91dGVyXSk7XG5cbiAgLy8gQXV0by1yZWZyZXNoIHdoZW4gYW5hbHlzaXMgaXMgaW4gcHJvZ3Jlc3NcbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoIXN1Ym1pc3Npb24gfHwgc3VibWlzc2lvbi5haV9hbmFseXNpc19zdGF0dXMgPT09IFwiY29tcGxldGVkXCIpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBQb2xsIGV2ZXJ5IDEwIHNlY29uZHMgd2hlbiBhbmFseXNpcyBpcyBub3QgY29tcGxldGVkXG4gICAgY29uc3QgaW50ZXJ2YWxJZCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKFwiQXV0by1yZWZyZXNoaW5nIHN1Ym1pc3Npb24gZGF0YS4uLlwiKTtcbiAgICAgIGxvYWRTdWJtaXNzaW9uRGF0YSgpO1xuICAgIH0sIDEwMDAwKTtcblxuICAgIHJldHVybiAoKSA9PiBjbGVhckludGVydmFsKGludGVydmFsSWQpO1xuICB9LCBbc3VibWlzc2lvbj8uYWlfYW5hbHlzaXNfc3RhdHVzXSk7XG5cbiAgY29uc3QgbG9hZFN1Ym1pc3Npb25EYXRhID0gYXN5bmMgKCkgPT4ge1xuICAgIHNldElzTG9hZGluZyh0cnVlKTtcbiAgICBzZXRFcnJvcihudWxsKTtcblxuICAgIHRyeSB7XG4gICAgICAvLyBMb2FkIHN1Ym1pc3Npb24gZGV0YWlscywgZmVlZGJhY2ssIGFuZCBxdWVzdGlvbnNcbiAgICAgIGNvbnN0IFtzdWJtaXNzaW9uUmVzdWx0LCBmZWVkYmFja1Jlc3VsdCwgcXVlc3Rpb25zUmVzdWx0XSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgICAgYXBpQ2xpZW50LmdldFN1Ym1pc3Npb24oc3VibWlzc2lvbklkKSxcbiAgICAgICAgYXBpQ2xpZW50LmdldFN1Ym1pc3Npb25GZWVkYmFjayhzdWJtaXNzaW9uSWQpLFxuICAgICAgICBhcGlDbGllbnQuZ2V0QW5zd2VycyhzdWJtaXNzaW9uSWQpLFxuICAgICAgXSk7XG5cbiAgICAgIGlmIChzdWJtaXNzaW9uUmVzdWx0LmVycm9yKSB7XG4gICAgICAgIHNldEVycm9yKHN1Ym1pc3Npb25SZXN1bHQuZXJyb3IpO1xuICAgICAgfSBlbHNlIGlmIChzdWJtaXNzaW9uUmVzdWx0LmRhdGEpIHtcbiAgICAgICAgc2V0U3VibWlzc2lvbihzdWJtaXNzaW9uUmVzdWx0LmRhdGEpO1xuICAgICAgfVxuXG4gICAgICBpZiAoZmVlZGJhY2tSZXN1bHQuZGF0YSkge1xuICAgICAgICBzZXRGZWVkYmFjayhmZWVkYmFja1Jlc3VsdC5kYXRhKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHF1ZXN0aW9uc1Jlc3VsdC5kYXRhKSB7XG4gICAgICAgIHNldFF1ZXN0aW9ucyhxdWVzdGlvbnNSZXN1bHQuZGF0YS5xdWVzdGlvbnMgfHwgW10pO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgc2V0RXJyb3IoXCJGYWlsZWQgdG8gbG9hZCBzdWJtaXNzaW9uIGRhdGFcIik7XG4gICAgICBjb25zb2xlLmVycm9yKGVycik7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHNldElzTG9hZGluZyhmYWxzZSk7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGhhbmRsZVN1Ym1pdEFuc3dlciA9IGFzeW5jIChxdWVzdGlvbklkOiBzdHJpbmcpID0+IHtcbiAgICBjb25zdCB0ZXh0ID0gYW5zd2VyVGV4dFtxdWVzdGlvbklkXTtcbiAgICBpZiAoIXRleHQgfHwgIXRleHQudHJpbSgpKSByZXR1cm47XG5cbiAgICBzZXRJc1N1Ym1pdHRpbmdBbnN3ZXIocXVlc3Rpb25JZCk7XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYXBpQ2xpZW50LnN1Ym1pdEFuc3dlcihzdWJtaXNzaW9uSWQsIHtcbiAgICAgICAgcXVlc3Rpb25faWQ6IHF1ZXN0aW9uSWQsXG4gICAgICAgIGFuc3dlcl90ZXh0OiB0ZXh0LFxuICAgICAgfSk7XG5cbiAgICAgIGlmIChyZXN1bHQuZXJyb3IpIHtcbiAgICAgICAgYWxlcnQoYEZhaWxlZCB0byBzdWJtaXQgYW5zd2VyOiAke3Jlc3VsdC5lcnJvcn1gKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIENsZWFyIGlucHV0IGFuZCByZWxvYWQgcXVlc3Rpb25zXG4gICAgICAgIHNldEFuc3dlclRleHQoeyAuLi5hbnN3ZXJUZXh0LCBbcXVlc3Rpb25JZF06IFwiXCIgfSk7XG4gICAgICAgIGNvbnN0IHF1ZXN0aW9uc1Jlc3VsdCA9IGF3YWl0IGFwaUNsaWVudC5nZXRBbnN3ZXJzKHN1Ym1pc3Npb25JZCk7XG4gICAgICAgIGlmIChxdWVzdGlvbnNSZXN1bHQuZGF0YSkge1xuICAgICAgICAgIHNldFF1ZXN0aW9ucyhxdWVzdGlvbnNSZXN1bHQuZGF0YS5xdWVzdGlvbnMgfHwgW10pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBhbGVydChcIkZhaWxlZCB0byBzdWJtaXQgYW5zd2VyXCIpO1xuICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBzZXRJc1N1Ym1pdHRpbmdBbnN3ZXIobnVsbCk7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGdldFNjb3JlQ29sb3IgPSAoc2NvcmU6IG51bWJlcikgPT4ge1xuICAgIGlmIChzY29yZSA+PSA4MCkgcmV0dXJuIFwidGV4dC1ncmVlbi02MDBcIjtcbiAgICBpZiAoc2NvcmUgPj0gNjApIHJldHVybiBcInRleHQteWVsbG93LTYwMFwiO1xuICAgIHJldHVybiBcInRleHQtcmVkLTYwMFwiO1xuICB9O1xuXG4gIGNvbnN0IGdldFNjb3JlQmFkZ2VWYXJpYW50ID0gKHNjb3JlOiBudW1iZXIpOiBcImRlZmF1bHRcIiB8IFwic2Vjb25kYXJ5XCIgfCBcImRlc3RydWN0aXZlXCIgfCBcIm91dGxpbmVcIiA9PiB7XG4gICAgaWYgKHNjb3JlID49IDgwKSByZXR1cm4gXCJkZWZhdWx0XCI7XG4gICAgaWYgKHNjb3JlID49IDYwKSByZXR1cm4gXCJzZWNvbmRhcnlcIjtcbiAgICByZXR1cm4gXCJkZXN0cnVjdGl2ZVwiO1xuICB9O1xuXG4gIGNvbnN0IGdldFByaW9yaXR5QmFkZ2VWYXJpYW50ID0gKHByaW9yaXR5OiBzdHJpbmcpOiBcImRlZmF1bHRcIiB8IFwic2Vjb25kYXJ5XCIgfCBcImRlc3RydWN0aXZlXCIgfCBcIm91dGxpbmVcIiA9PiB7XG4gICAgaWYgKHByaW9yaXR5ID09PSBcImhpZ2hcIikgcmV0dXJuIFwiZGVzdHJ1Y3RpdmVcIjtcbiAgICBpZiAocHJpb3JpdHkgPT09IFwibWVkaXVtXCIpIHJldHVybiBcInNlY29uZGFyeVwiO1xuICAgIHJldHVybiBcIm91dGxpbmVcIjtcbiAgfTtcblxuICBjb25zdCBjb3B5VG9DbGlwYm9hcmQgPSBhc3luYyAodGV4dDogc3RyaW5nLCBzZWN0aW9uOiBzdHJpbmcpID0+IHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQodGV4dCk7XG4gICAgICBzZXRDb3BpZWRTZWN0aW9uKHNlY3Rpb24pO1xuICAgICAgdG9hc3Quc3VjY2VzcyhcIkNvcGllZCB0byBjbGlwYm9hcmQhXCIpO1xuICAgICAgc2V0VGltZW91dCgoKSA9PiBzZXRDb3BpZWRTZWN0aW9uKG51bGwpLCAyMDAwKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIHRvYXN0LmVycm9yKFwiRmFpbGVkIHRvIGNvcHkgdG8gY2xpcGJvYXJkXCIpO1xuICAgICAgY29uc29sZS5lcnJvcihcIkNvcHkgZmFpbGVkOlwiLCBlcnIpO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBoYW5kbGVEb3dubG9hZE1haW5Eb2N1bWVudCA9IGFzeW5jICgpID0+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgYXBpQ2xpZW50LmRvd25sb2FkU3VibWlzc2lvbkZpbGUoc3VibWlzc2lvbklkKTtcbiAgICAgIGlmIChyZXN1bHQuZGF0YT8uZG93bmxvYWRfdXJsKSB7XG4gICAgICAgIC8vIE9wZW4gcHJlc2lnbmVkIFVSTCBpbiBuZXcgdGFiIHRvIHRyaWdnZXIgZG93bmxvYWRcbiAgICAgICAgd2luZG93Lm9wZW4ocmVzdWx0LmRhdGEuZG93bmxvYWRfdXJsLCAnX2JsYW5rJyk7XG4gICAgICAgIHRvYXN0LnN1Y2Nlc3MoYERvd25sb2FkaW5nICR7cmVzdWx0LmRhdGEuZmlsZV9uYW1lfWApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdG9hc3QuZXJyb3IocmVzdWx0LmVycm9yIHx8IFwiRmFpbGVkIHRvIGdldCBkb3dubG9hZCBVUkxcIik7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICB0b2FzdC5lcnJvcihcIkZhaWxlZCB0byBkb3dubG9hZCBmaWxlXCIpO1xuICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBoYW5kbGVEb3dubG9hZEFwcGVuZGl4ID0gYXN5bmMgKGFwcGVuZGl4T3JkZXI6IG51bWJlciwgZmlsZU5hbWU6IHN0cmluZykgPT4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBhcGlDbGllbnQuZG93bmxvYWRBcHBlbmRpeChzdWJtaXNzaW9uSWQsIGFwcGVuZGl4T3JkZXIpO1xuICAgICAgaWYgKHJlc3VsdC5kYXRhPy5kb3dubG9hZF91cmwpIHtcbiAgICAgICAgLy8gT3BlbiBwcmVzaWduZWQgVVJMIGluIG5ldyB0YWIgdG8gdHJpZ2dlciBkb3dubG9hZFxuICAgICAgICB3aW5kb3cub3BlbihyZXN1bHQuZGF0YS5kb3dubG9hZF91cmwsICdfYmxhbmsnKTtcbiAgICAgICAgdG9hc3Quc3VjY2VzcyhgRG93bmxvYWRpbmcgJHtmaWxlTmFtZX1gKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRvYXN0LmVycm9yKHJlc3VsdC5lcnJvciB8fCBcIkZhaWxlZCB0byBnZXQgZG93bmxvYWQgVVJMXCIpO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdG9hc3QuZXJyb3IoXCJGYWlsZWQgdG8gZG93bmxvYWQgYXBwZW5kaXhcIik7XG4gICAgICBjb25zb2xlLmVycm9yKGVycik7XG4gICAgfVxuICB9O1xuXG4gIGlmIChpc0xvYWRpbmcpIHtcbiAgICByZXR1cm4gKFxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJtaW4taC1zY3JlZW4gYmctZ3JhZGllbnQtdG8tYiBmcm9tLXNsYXRlLTUwIHRvLXNsYXRlLTEwMCBkYXJrOmZyb20tc2xhdGUtOTAwIGRhcms6dG8tc2xhdGUtODAwIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyXCI+XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC1jZW50ZXJcIj5cbiAgICAgICAgICA8TG9hZGVyMiBjbGFzc05hbWU9XCJoLTggdy04IGFuaW1hdGUtc3BpbiBteC1hdXRvIG1iLTQgdGV4dC1zbGF0ZS02MDBcIiAvPlxuICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtc2xhdGUtNjAwIGRhcms6dGV4dC1zbGF0ZS00MDBcIj5Mb2FkaW5nIHN1Ym1pc3Npb24uLi48L3A+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgKTtcbiAgfVxuXG4gIGlmIChlcnJvcikge1xuICAgIHJldHVybiAoXG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1pbi1oLXNjcmVlbiBiZy1ncmFkaWVudC10by1iIGZyb20tc2xhdGUtNTAgdG8tc2xhdGUtMTAwIGRhcms6ZnJvbS1zbGF0ZS05MDAgZGFyazp0by1zbGF0ZS04MDBcIj5cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJjb250YWluZXIgbXgtYXV0byBwLTYgbWF4LXctN3hsXCI+XG4gICAgICAgICAgPEJ1dHRvbiB2YXJpYW50PVwiZ2hvc3RcIiBvbkNsaWNrPXsoKSA9PiByb3V0ZXIuYmFjaygpfSBjbGFzc05hbWU9XCJtYi00XCI+XG4gICAgICAgICAgICA8QXJyb3dMZWZ0IGNsYXNzTmFtZT1cIm1yLTIgaC00IHctNFwiIC8+XG4gICAgICAgICAgICBCYWNrXG4gICAgICAgICAgPC9CdXR0b24+XG4gICAgICAgICAgPEFsZXJ0IHZhcmlhbnQ9XCJkZXN0cnVjdGl2ZVwiPlxuICAgICAgICAgICAgPEFsZXJ0RGVzY3JpcHRpb24+e2Vycm9yfTwvQWxlcnREZXNjcmlwdGlvbj5cbiAgICAgICAgICA8L0FsZXJ0PlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuICAgICk7XG4gIH1cblxuICBpZiAoIXN1Ym1pc3Npb24pIHtcbiAgICByZXR1cm4gKFxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJtaW4taC1zY3JlZW4gYmctZ3JhZGllbnQtdG8tYiBmcm9tLXNsYXRlLTUwIHRvLXNsYXRlLTEwMCBkYXJrOmZyb20tc2xhdGUtOTAwIGRhcms6dG8tc2xhdGUtODAwXCI+XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiY29udGFpbmVyIG14LWF1dG8gcC02IG1heC13LTd4bFwiPlxuICAgICAgICAgIDxCdXR0b24gdmFyaWFudD1cImdob3N0XCIgb25DbGljaz17KCkgPT4gcm91dGVyLmJhY2soKX0gY2xhc3NOYW1lPVwibWItNFwiPlxuICAgICAgICAgICAgPEFycm93TGVmdCBjbGFzc05hbWU9XCJtci0yIGgtNCB3LTRcIiAvPlxuICAgICAgICAgICAgQmFja1xuICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtc2xhdGUtNjAwIGRhcms6dGV4dC1zbGF0ZS00MDBcIj5TdWJtaXNzaW9uIG5vdCBmb3VuZDwvcD5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIChcbiAgICA8VGV4dFNlbGVjdGlvbkhhbmRsZXI+XG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1pbi1oLXNjcmVlbiBiZy1ncmFkaWVudC10by1iIGZyb20tc2xhdGUtNTAgdG8tc2xhdGUtMTAwIGRhcms6ZnJvbS1zbGF0ZS05MDAgZGFyazp0by1zbGF0ZS04MDBcIj5cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJjb250YWluZXIgbXgtYXV0byBwLTYgbWF4LXctN3hsXCI+XG4gICAgICAgIHsvKiBIZWFkZXIgKi99XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibWItOFwiPlxuICAgICAgICAgIDxCdXR0b24gdmFyaWFudD1cImdob3N0XCIgb25DbGljaz17KCkgPT4gcm91dGVyLmJhY2soKX0gY2xhc3NOYW1lPVwibWItNFwiPlxuICAgICAgICAgICAgPEFycm93TGVmdCBjbGFzc05hbWU9XCJtci0yIGgtNCB3LTRcIiAvPlxuICAgICAgICAgICAgQmFja1xuICAgICAgICAgIDwvQnV0dG9uPlxuXG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLXN0YXJ0IGp1c3RpZnktYmV0d2VlblwiPlxuICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgPGgxIGNsYXNzTmFtZT1cInRleHQtNHhsIGZvbnQtYm9sZCB0ZXh0LXNsYXRlLTkwMCBkYXJrOnRleHQtc2xhdGUtNTAgbWItMlwiPlxuICAgICAgICAgICAgICAgIHtzdWJtaXNzaW9uLmRvY3VtZW50X25hbWV9XG4gICAgICAgICAgICAgIDwvaDE+XG4gICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtc2xhdGUtNjAwIGRhcms6dGV4dC1zbGF0ZS00MDAgbWItNFwiPlxuICAgICAgICAgICAgICAgIFN1Ym1pdHRlZCBvbiB7bmV3IERhdGUoc3VibWlzc2lvbi5zdWJtaXR0ZWRfYXQpLnRvTG9jYWxlU3RyaW5nKCl9XG4gICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGdhcC0yXCI+XG4gICAgICAgICAgICAgICAgPEJhZGdlIHZhcmlhbnQ9e2dldFNjb3JlQmFkZ2VWYXJpYW50KHN1Ym1pc3Npb24ub3ZlcmFsbF9zY29yZSB8fCAwKX0+XG4gICAgICAgICAgICAgICAgICB7c3VibWlzc2lvbi5zdGF0dXN9XG4gICAgICAgICAgICAgICAgPC9CYWRnZT5cbiAgICAgICAgICAgICAgICA8QmFkZ2UgdmFyaWFudD1cIm91dGxpbmVcIj57c3VibWlzc2lvbi5haV9hbmFseXNpc19zdGF0dXN9PC9CYWRnZT5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDxCdXR0b24gb25DbGljaz17bG9hZFN1Ym1pc3Npb25EYXRhfSB2YXJpYW50PVwib3V0bGluZVwiPlxuICAgICAgICAgICAgICA8UmVmcmVzaEN3IGNsYXNzTmFtZT1cIm1yLTIgaC00IHctNFwiIC8+XG4gICAgICAgICAgICAgIFJlZnJlc2hcbiAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cblxuICAgICAgICB7LyogRmlsZXMgU3VibWl0dGVkIFNlY3Rpb24gKi99XG4gICAgICAgIDxDYXJkIGNsYXNzTmFtZT1cIm1iLTZcIj5cbiAgICAgICAgICA8Q2FyZEhlYWRlcj5cbiAgICAgICAgICAgIDxDYXJkVGl0bGUgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTJcIj5cbiAgICAgICAgICAgICAgPEZpbGVUZXh0IGNsYXNzTmFtZT1cImgtNSB3LTVcIiAvPlxuICAgICAgICAgICAgICBGaWxlcyBTdWJtaXR0ZWRcbiAgICAgICAgICAgIDwvQ2FyZFRpdGxlPlxuICAgICAgICAgICAgPENhcmREZXNjcmlwdGlvbj5cbiAgICAgICAgICAgICAge3N1Ym1pc3Npb24uYXBwZW5kaXhfZmlsZXMgJiYgc3VibWlzc2lvbi5hcHBlbmRpeF9maWxlcy5sZW5ndGggPiAwXG4gICAgICAgICAgICAgICAgPyBgTWFpbiBkb2N1bWVudCBhbmQgJHtzdWJtaXNzaW9uLmFwcGVuZGl4X2ZpbGVzLmxlbmd0aH0gYXBwZW5kaXgke3N1Ym1pc3Npb24uYXBwZW5kaXhfZmlsZXMubGVuZ3RoID4gMSA/ICdlcycgOiAnJ31gXG4gICAgICAgICAgICAgICAgOiBcIk1haW4gZG9jdW1lbnRcIn1cbiAgICAgICAgICAgIDwvQ2FyZERlc2NyaXB0aW9uPlxuICAgICAgICAgIDwvQ2FyZEhlYWRlcj5cbiAgICAgICAgICA8Q2FyZENvbnRlbnQgY2xhc3NOYW1lPVwic3BhY2UteS02XCI+XG4gICAgICAgICAgICB7LyogTWFpbiBEb2N1bWVudCAqL31cbiAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgIDxoNCBjbGFzc05hbWU9XCJ0ZXh0LXNtIGZvbnQtc2VtaWJvbGQgdGV4dC1zbGF0ZS03MDAgZGFyazp0ZXh0LXNsYXRlLTMwMCBtYi0zXCI+XG4gICAgICAgICAgICAgICAgTWFpbiBEb2N1bWVudFxuICAgICAgICAgICAgICA8L2g0PlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBiZy1ibHVlLTUwIGRhcms6YmctYmx1ZS05MDAvMjAgcC00IHJvdW5kZWQtbGcgYm9yZGVyLTIgYm9yZGVyLWJsdWUtMjAwIGRhcms6Ym9yZGVyLWJsdWUtODAwXCI+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMyBmbGV4LTFcIj5cbiAgICAgICAgICAgICAgICAgIDxGaWxlVGV4dCBjbGFzc05hbWU9XCJoLTUgdy01IHRleHQtYmx1ZS02MDAgZGFyazp0ZXh0LWJsdWUtNDAwXCIgLz5cbiAgICAgICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cImZvbnQtbWVkaXVtIHRleHQtc2xhdGUtOTAwIGRhcms6dGV4dC1zbGF0ZS0xMDBcIj5cbiAgICAgICAgICAgICAgICAgICAgICB7c3VibWlzc2lvbi5kb2N1bWVudF9uYW1lfVxuICAgICAgICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtc20gdGV4dC1zbGF0ZS01MDAgZGFyazp0ZXh0LXNsYXRlLTQwMFwiPlxuICAgICAgICAgICAgICAgICAgICAgIHtzdWJtaXNzaW9uLmZpbGVfc2l6ZSA/IGAkeyhzdWJtaXNzaW9uLmZpbGVfc2l6ZSAvIDEwMjQpLnRvRml4ZWQoMCl9IEtCYCA6ICdTaXplIHVua25vd24nfVxuICAgICAgICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICAgICAgICB2YXJpYW50PVwib3V0bGluZVwiXG4gICAgICAgICAgICAgICAgICBzaXplPVwic21cIlxuICAgICAgICAgICAgICAgICAgb25DbGljaz17aGFuZGxlRG93bmxvYWRNYWluRG9jdW1lbnR9XG4gICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgPERvd25sb2FkIGNsYXNzTmFtZT1cImgtNCB3LTQgbXItMlwiIC8+XG4gICAgICAgICAgICAgICAgICBEb3dubG9hZFxuICAgICAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICB7LyogQXBwZW5kaWNlcyAqL31cbiAgICAgICAgICAgIHtzdWJtaXNzaW9uLmFwcGVuZGl4X2ZpbGVzICYmIHN1Ym1pc3Npb24uYXBwZW5kaXhfZmlsZXMubGVuZ3RoID4gMCAmJiAoXG4gICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgPGg0IGNsYXNzTmFtZT1cInRleHQtc20gZm9udC1zZW1pYm9sZCB0ZXh0LXNsYXRlLTcwMCBkYXJrOnRleHQtc2xhdGUtMzAwIG1iLTNcIj5cbiAgICAgICAgICAgICAgICAgIEFwcGVuZGljZXMgKHtzdWJtaXNzaW9uLmFwcGVuZGl4X2ZpbGVzLmxlbmd0aH0pXG4gICAgICAgICAgICAgICAgPC9oND5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLXktMlwiPlxuICAgICAgICAgICAgICAgICAge3N1Ym1pc3Npb24uYXBwZW5kaXhfZmlsZXMubWFwKChhcHBlbmRpeDogYW55LCBpbmRleDogbnVtYmVyKSA9PiAoXG4gICAgICAgICAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgICAgICAgICBrZXk9e2luZGV4fVxuICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBiZy1zbGF0ZS01MCBkYXJrOmJnLXNsYXRlLTkwMCBwLTQgcm91bmRlZC1sZyBib3JkZXIgYm9yZGVyLXNsYXRlLTIwMCBkYXJrOmJvcmRlci1zbGF0ZS03MDBcIlxuICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMyBmbGV4LTFcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxQYXBlcmNsaXAgY2xhc3NOYW1lPVwiaC01IHctNSB0ZXh0LXNsYXRlLTUwMFwiIC8+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJmb250LW1lZGl1bSB0ZXh0LXNsYXRlLTkwMCBkYXJrOnRleHQtc2xhdGUtMTAwXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge2FwcGVuZGl4LmZpbGVfbmFtZX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXNtIHRleHQtc2xhdGUtNTAwIGRhcms6dGV4dC1zbGF0ZS00MDBcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7KGFwcGVuZGl4LmZpbGVfc2l6ZSAvIDEwMjQpLnRvRml4ZWQoMCl9IEtCIOKAoiBBcHBlbmRpeCB7YXBwZW5kaXgudXBsb2FkX29yZGVyfVxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXJpYW50PVwib3V0bGluZVwiXG4gICAgICAgICAgICAgICAgICAgICAgICBzaXplPVwic21cIlxuICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gaGFuZGxlRG93bmxvYWRBcHBlbmRpeChhcHBlbmRpeC51cGxvYWRfb3JkZXIsIGFwcGVuZGl4LmZpbGVfbmFtZSl9XG4gICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgPERvd25sb2FkIGNsYXNzTmFtZT1cImgtNCB3LTQgbXItMlwiIC8+XG4gICAgICAgICAgICAgICAgICAgICAgICBEb3dubG9hZFxuICAgICAgICAgICAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICkpfVxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICl9XG4gICAgICAgICAgPC9DYXJkQ29udGVudD5cbiAgICAgICAgPC9DYXJkPlxuXG4gICAgICAgIHsvKiBBSSBBbmFseXNpcyBTdGF0dXMgKi99XG4gICAgICAgIHtzdWJtaXNzaW9uLmFpX2FuYWx5c2lzX3N0YXR1cyAhPT0gXCJjb21wbGV0ZWRcIiAmJiAoXG4gICAgICAgICAgPEFsZXJ0IGNsYXNzTmFtZT1cIm1iLTYgYm9yZGVyLTIgYm9yZGVyLWJsdWUtMjAwIGRhcms6Ym9yZGVyLWJsdWUtODAwIGJnLWJsdWUtNTAgZGFyazpiZy1ibHVlLTkwMC8yMFwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLXN0YXJ0IGdhcC0zXCI+XG4gICAgICAgICAgICAgIDxMb2FkZXIyIGNsYXNzTmFtZT1cImgtNSB3LTUgdGV4dC1ibHVlLTYwMCBkYXJrOnRleHQtYmx1ZS00MDAgYW5pbWF0ZS1zcGluIG10LTAuNSBmbGV4LXNocmluay0wXCIgLz5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4LTFcIj5cbiAgICAgICAgICAgICAgICA8QWxlcnRUaXRsZSBjbGFzc05hbWU9XCJ0ZXh0LWJsdWUtOTAwIGRhcms6dGV4dC1ibHVlLTEwMCBtYi0yXCI+XG4gICAgICAgICAgICAgICAgICB7c3VibWlzc2lvbi5haV9hbmFseXNpc19zdGF0dXMgPT09IFwiaW5fcHJvZ3Jlc3NcIlxuICAgICAgICAgICAgICAgICAgICA/IFwi8J+kliBBSSBBbmFseXNpcyBpbiBQcm9ncmVzc1wiXG4gICAgICAgICAgICAgICAgICAgIDogc3VibWlzc2lvbi5haV9hbmFseXNpc19zdGF0dXMgPT09IFwicGVuZGluZ1wiXG4gICAgICAgICAgICAgICAgICAgID8gXCLij7MgUHJlcGFyaW5nIEFuYWx5c2lzXCJcbiAgICAgICAgICAgICAgICAgICAgOiBcIkFuYWx5c2lzIFN0YXR1c1wifVxuICAgICAgICAgICAgICAgIDwvQWxlcnRUaXRsZT5cbiAgICAgICAgICAgICAgICA8QWxlcnREZXNjcmlwdGlvbj5cbiAgICAgICAgICAgICAgICAgIHtzdWJtaXNzaW9uLmFpX2FuYWx5c2lzX3N0YXR1cyA9PT0gXCJpbl9wcm9ncmVzc1wiID8gKFxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLXktMlwiPlxuICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtYmx1ZS04MDAgZGFyazp0ZXh0LWJsdWUtMjAwIGZvbnQtbWVkaXVtXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA2IEFJIGFnZW50cyBhcmUgYW5hbHl6aW5nIHlvdXIgZG9jdW1lbnQuIFRoaXMgdHlwaWNhbGx5IHRha2VzIDxzdHJvbmc+MS0yIG1pbnV0ZXM8L3N0cm9uZz4uXG4gICAgICAgICAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTIgdGV4dC1zbSB0ZXh0LWJsdWUtNzAwIGRhcms6dGV4dC1ibHVlLTMwMFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInctMiBoLTIgYmctYmx1ZS02MDAgZGFyazpiZy1ibHVlLTQwMCByb3VuZGVkLWZ1bGwgYW5pbWF0ZS1wdWxzZVwiPjwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8c3Bhbj5BdXRvLXJlZnJlc2hpbmcgZXZlcnkgMTAgc2Vjb25kczwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC1ibHVlLTYwMCBkYXJrOnRleHQtYmx1ZS00MDAgbXQtMlwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgWW91IGNhbiBzYWZlbHkgY2xvc2UgdGhpcyBwYWdlLiBBbmFseXNpcyB3aWxsIGNvbnRpbnVlIGluIHRoZSBiYWNrZ3JvdW5kLlxuICAgICAgICAgICAgICAgICAgICAgIDwvcD5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICApIDogc3VibWlzc2lvbi5haV9hbmFseXNpc19zdGF0dXMgPT09IFwicGVuZGluZ1wiID8gKFxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNwYWNlLXktMlwiPlxuICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtYmx1ZS04MDAgZGFyazp0ZXh0LWJsdWUtMjAwXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICBZb3VyIGRvY3VtZW50IGlzIHF1ZXVlZCBmb3IgQUkgYW5hbHlzaXMuIFN0YXJ0aW5nIHNob3J0bHkuLi5cbiAgICAgICAgICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMiB0ZXh0LXNtIHRleHQtYmx1ZS03MDAgZGFyazp0ZXh0LWJsdWUtMzAwXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0xXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidy0yIGgtMiBiZy1ibHVlLTYwMCBkYXJrOmJnLWJsdWUtNDAwIHJvdW5kZWQtZnVsbCBhbmltYXRlLXB1bHNlXCI+PC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuPkF1dG8tcmVmcmVzaGluZyBldmVyeSAxMCBzZWNvbmRzPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgKSA6IChcbiAgICAgICAgICAgICAgICAgICAgPHA+QW5hbHlzaXMgc3RhdHVzOiB7c3VibWlzc2lvbi5haV9hbmFseXNpc19zdGF0dXN9PC9wPlxuICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICA8L0FsZXJ0RGVzY3JpcHRpb24+XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9BbGVydD5cbiAgICAgICAgKX1cblxuICAgICAgICB7LyogT3ZlcmFsbCBTY29yZSAoaWYgYXZhaWxhYmxlKSAqL31cbiAgICAgICAge2ZlZWRiYWNrICYmIGZlZWRiYWNrLm92ZXJhbGxfc2NvcmUgIT09IG51bGwgJiYgKFxuICAgICAgICAgIDxDYXJkIGNsYXNzTmFtZT1cIm1iLTggYm9yZGVyLTJcIj5cbiAgICAgICAgICAgIDxDYXJkSGVhZGVyPlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlblwiPlxuICAgICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgICA8Q2FyZFRpdGxlIGNsYXNzTmFtZT1cInRleHQtMnhsIG1iLTJcIj5PdmVyYWxsIEFuYWx5c2lzIFNjb3JlPC9DYXJkVGl0bGU+XG4gICAgICAgICAgICAgICAgICA8Q2FyZERlc2NyaXB0aW9uPkFJLWdlbmVyYXRlZCBldmFsdWF0aW9uIG9mIHlvdXIgZG9jdW1lbnQ8L0NhcmREZXNjcmlwdGlvbj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQtY2VudGVyXCI+XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT17YHRleHQtNnhsIGZvbnQtYm9sZCAke2dldFNjb3JlQ29sb3IoZmVlZGJhY2sub3ZlcmFsbF9zY29yZSl9YH0+XG4gICAgICAgICAgICAgICAgICAgIHtmZWVkYmFjay5vdmVyYWxsX3Njb3JlfVxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQtc20gdGV4dC1zbGF0ZS01MDAgZGFyazp0ZXh0LXNsYXRlLTQwMFwiPm91dCBvZiAxMDA8L2Rpdj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L0NhcmRIZWFkZXI+XG4gICAgICAgICAgICB7ZmVlZGJhY2suZGV0YWlsZWRfZmVlZGJhY2sgJiYgKFxuICAgICAgICAgICAgICA8Q2FyZENvbnRlbnQ+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJyZWxhdGl2ZVwiPlxuICAgICAgICAgICAgICAgICAgPEFsZXJ0IHZhcmlhbnQ9XCJkZWZhdWx0XCI+XG4gICAgICAgICAgICAgICAgICAgIDxBbGVydERlc2NyaXB0aW9uPntmZWVkYmFjay5kZXRhaWxlZF9mZWVkYmFja308L0FsZXJ0RGVzY3JpcHRpb24+XG4gICAgICAgICAgICAgICAgICA8L0FsZXJ0PlxuICAgICAgICAgICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgICAgICAgICB2YXJpYW50PVwiZ2hvc3RcIlxuICAgICAgICAgICAgICAgICAgICBzaXplPVwic21cIlxuICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBjb3B5VG9DbGlwYm9hcmQoZmVlZGJhY2suZGV0YWlsZWRfZmVlZGJhY2ssIFwib3ZlcmFsbFwiKX1cbiAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYWJzb2x1dGUgdG9wLTIgcmlnaHQtMlwiXG4gICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgIHtjb3BpZWRTZWN0aW9uID09PSBcIm92ZXJhbGxcIiA/IChcbiAgICAgICAgICAgICAgICAgICAgICA8Q2hlY2sgY2xhc3NOYW1lPVwiaC00IHctNCB0ZXh0LWdyZWVuLTUwMFwiIC8+XG4gICAgICAgICAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgICAgICAgICAgPENvcHkgY2xhc3NOYW1lPVwiaC00IHctNFwiIC8+XG4gICAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICA8L0J1dHRvbj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPC9DYXJkQ29udGVudD5cbiAgICAgICAgICAgICl9XG4gICAgICAgICAgPC9DYXJkPlxuICAgICAgICApfVxuXG4gICAgICAgIHsvKiBEZXRhaWxlZCBBbmFseXNpcyAqL31cbiAgICAgICAge2ZlZWRiYWNrICYmIChcbiAgICAgICAgICA8VGFicyBkZWZhdWx0VmFsdWU9XCJzdHJlbmd0aHNcIiBjbGFzc05hbWU9XCJtYi04XCI+XG4gICAgICAgICAgICA8VGFic0xpc3QgY2xhc3NOYW1lPVwiZ3JpZCB3LWZ1bGwgZ3JpZC1jb2xzLTNcIj5cbiAgICAgICAgICAgICAgPFRhYnNUcmlnZ2VyIHZhbHVlPVwic3RyZW5ndGhzXCI+XG4gICAgICAgICAgICAgICAgU3RyZW5ndGhzICh7ZmVlZGJhY2suc3RyZW5ndGhzPy5sZW5ndGggfHwgMH0pXG4gICAgICAgICAgICAgIDwvVGFic1RyaWdnZXI+XG4gICAgICAgICAgICAgIDxUYWJzVHJpZ2dlciB2YWx1ZT1cIndlYWtuZXNzZXNcIj5cbiAgICAgICAgICAgICAgICBXZWFrbmVzc2VzICh7ZmVlZGJhY2sud2Vha25lc3Nlcz8ubGVuZ3RoIHx8IDB9KVxuICAgICAgICAgICAgICA8L1RhYnNUcmlnZ2VyPlxuICAgICAgICAgICAgICA8VGFic1RyaWdnZXIgdmFsdWU9XCJyZWNvbW1lbmRhdGlvbnNcIj5cbiAgICAgICAgICAgICAgICBSZWNvbW1lbmRhdGlvbnMgKHtmZWVkYmFjay5yZWNvbW1lbmRhdGlvbnM/Lmxlbmd0aCB8fCAwfSlcbiAgICAgICAgICAgICAgPC9UYWJzVHJpZ2dlcj5cbiAgICAgICAgICAgIDwvVGFic0xpc3Q+XG5cbiAgICAgICAgICAgIDxUYWJzQ29udGVudCB2YWx1ZT1cInN0cmVuZ3Roc1wiPlxuICAgICAgICAgICAgICA8Q2FyZD5cbiAgICAgICAgICAgICAgICA8Q2FyZEhlYWRlcj5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuXCI+XG4gICAgICAgICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgICAgICAgPENhcmRUaXRsZSBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMlwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPFRyZW5kaW5nVXAgY2xhc3NOYW1lPVwiaC01IHctNSB0ZXh0LWdyZWVuLTYwMFwiIC8+XG4gICAgICAgICAgICAgICAgICAgICAgICBEb2N1bWVudCBTdHJlbmd0aHNcbiAgICAgICAgICAgICAgICAgICAgICA8L0NhcmRUaXRsZT5cbiAgICAgICAgICAgICAgICAgICAgICA8Q2FyZERlc2NyaXB0aW9uPlBvc2l0aXZlIGFzcGVjdHMgaWRlbnRpZmllZCBieSBBSTwvQ2FyZERlc2NyaXB0aW9uPlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAge2ZlZWRiYWNrLnN0cmVuZ3RocyAmJiBmZWVkYmFjay5zdHJlbmd0aHMubGVuZ3RoID4gMCAmJiAoXG4gICAgICAgICAgICAgICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyaWFudD1cImdob3N0XCJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpemU9XCJzbVwiXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRleHQgPSBmZWVkYmFjay5zdHJlbmd0aHNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAubWFwKChzOiBzdHJpbmcsIGk6IG51bWJlcikgPT4gYCR7aSArIDF9LiAke3N9YClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuam9pbihcIlxcblwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY29weVRvQ2xpcGJvYXJkKHRleHQsIFwic3RyZW5ndGhzXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICB7Y29waWVkU2VjdGlvbiA9PT0gXCJzdHJlbmd0aHNcIiA/IChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8Q2hlY2sgY2xhc3NOYW1lPVwiaC00IHctNCB0ZXh0LWdyZWVuLTUwMCBtci0yXCIgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBDb3BpZWRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC8+XG4gICAgICAgICAgICAgICAgICAgICAgICApIDogKFxuICAgICAgICAgICAgICAgICAgICAgICAgICA8PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxDb3B5IGNsYXNzTmFtZT1cImgtNCB3LTQgbXItMlwiIC8+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgQ29weSBBbGxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC8+XG4gICAgICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPC9DYXJkSGVhZGVyPlxuICAgICAgICAgICAgICAgIDxDYXJkQ29udGVudD5cbiAgICAgICAgICAgICAgICAgIHtmZWVkYmFjay5zdHJlbmd0aHMgJiYgZmVlZGJhY2suc3RyZW5ndGhzLmxlbmd0aCA+IDAgPyAoXG4gICAgICAgICAgICAgICAgICAgIDx1bCBjbGFzc05hbWU9XCJzcGFjZS15LTNcIj5cbiAgICAgICAgICAgICAgICAgICAgICB7ZmVlZGJhY2suc3RyZW5ndGhzLm1hcCgoc3RyZW5ndGg6IHN0cmluZywgaW5kZXg6IG51bWJlcikgPT4gKFxuICAgICAgICAgICAgICAgICAgICAgICAgPGxpIGtleT17aW5kZXh9IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtc3RhcnQgZ2FwLTNcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPENoZWNrQ2lyY2xlMiBjbGFzc05hbWU9XCJoLTUgdy01IHRleHQtZ3JlZW4tNjAwIG10LTAuNSBmbGV4LXNocmluay0wXCIgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1zbGF0ZS03MDAgZGFyazp0ZXh0LXNsYXRlLTMwMFwiPntzdHJlbmd0aH08L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2xpPlxuICAgICAgICAgICAgICAgICAgICAgICkpfVxuICAgICAgICAgICAgICAgICAgICA8L3VsPlxuICAgICAgICAgICAgICAgICAgKSA6IChcbiAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1zbGF0ZS02MDAgZGFyazp0ZXh0LXNsYXRlLTQwMFwiPk5vIHN0cmVuZ3RocyBpZGVudGlmaWVkPC9wPlxuICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICA8L0NhcmRDb250ZW50PlxuICAgICAgICAgICAgICA8L0NhcmQ+XG4gICAgICAgICAgICA8L1RhYnNDb250ZW50PlxuXG4gICAgICAgICAgICA8VGFic0NvbnRlbnQgdmFsdWU9XCJ3ZWFrbmVzc2VzXCI+XG4gICAgICAgICAgICAgIDxDYXJkPlxuICAgICAgICAgICAgICAgIDxDYXJkSGVhZGVyPlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW5cIj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICAgICAgICA8Q2FyZFRpdGxlIGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8VHJlbmRpbmdEb3duIGNsYXNzTmFtZT1cImgtNSB3LTUgdGV4dC1yZWQtNjAwXCIgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgIERvY3VtZW50IFdlYWtuZXNzZXNcbiAgICAgICAgICAgICAgICAgICAgICA8L0NhcmRUaXRsZT5cbiAgICAgICAgICAgICAgICAgICAgICA8Q2FyZERlc2NyaXB0aW9uPklzc3VlcyByZXF1aXJpbmcgYXR0ZW50aW9uPC9DYXJkRGVzY3JpcHRpb24+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICB7ZmVlZGJhY2sud2Vha25lc3NlcyAmJiBmZWVkYmFjay53ZWFrbmVzc2VzLmxlbmd0aCA+IDAgJiYgKFxuICAgICAgICAgICAgICAgICAgICAgIDxCdXR0b25cbiAgICAgICAgICAgICAgICAgICAgICAgIHZhcmlhbnQ9XCJnaG9zdFwiXG4gICAgICAgICAgICAgICAgICAgICAgICBzaXplPVwic21cIlxuICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0ZXh0ID0gZmVlZGJhY2sud2Vha25lc3Nlc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAoKHc6IHN0cmluZywgaTogbnVtYmVyKSA9PiBgJHtpICsgMX0uICR7d31gKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5qb2luKFwiXFxuXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBjb3B5VG9DbGlwYm9hcmQodGV4dCwgXCJ3ZWFrbmVzc2VzXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICB7Y29waWVkU2VjdGlvbiA9PT0gXCJ3ZWFrbmVzc2VzXCIgPyAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDw+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPENoZWNrIGNsYXNzTmFtZT1cImgtNCB3LTQgdGV4dC1ncmVlbi01MDAgbXItMlwiIC8+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgQ29waWVkXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvPlxuICAgICAgICAgICAgICAgICAgICAgICAgKSA6IChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8Q29weSBjbGFzc05hbWU9XCJoLTQgdy00IG1yLTJcIiAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIENvcHkgQWxsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvPlxuICAgICAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgICA8L0J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDwvQ2FyZEhlYWRlcj5cbiAgICAgICAgICAgICAgICA8Q2FyZENvbnRlbnQ+XG4gICAgICAgICAgICAgICAgICB7ZmVlZGJhY2sud2Vha25lc3NlcyAmJiBmZWVkYmFjay53ZWFrbmVzc2VzLmxlbmd0aCA+IDAgPyAoXG4gICAgICAgICAgICAgICAgICAgIDx1bCBjbGFzc05hbWU9XCJzcGFjZS15LTNcIj5cbiAgICAgICAgICAgICAgICAgICAgICB7ZmVlZGJhY2sud2Vha25lc3Nlcy5tYXAoKHdlYWtuZXNzOiBzdHJpbmcsIGluZGV4OiBudW1iZXIpID0+IChcbiAgICAgICAgICAgICAgICAgICAgICAgIDxsaSBrZXk9e2luZGV4fSBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLXN0YXJ0IGdhcC0zXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxYQ2lyY2xlIGNsYXNzTmFtZT1cImgtNSB3LTUgdGV4dC1yZWQtNjAwIG10LTAuNSBmbGV4LXNocmluay0wXCIgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1zbGF0ZS03MDAgZGFyazp0ZXh0LXNsYXRlLTMwMFwiPnt3ZWFrbmVzc308L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2xpPlxuICAgICAgICAgICAgICAgICAgICAgICkpfVxuICAgICAgICAgICAgICAgICAgICA8L3VsPlxuICAgICAgICAgICAgICAgICAgKSA6IChcbiAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1zbGF0ZS02MDAgZGFyazp0ZXh0LXNsYXRlLTQwMFwiPk5vIHdlYWtuZXNzZXMgaWRlbnRpZmllZDwvcD5cbiAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgPC9DYXJkQ29udGVudD5cbiAgICAgICAgICAgICAgPC9DYXJkPlxuICAgICAgICAgICAgPC9UYWJzQ29udGVudD5cblxuICAgICAgICAgICAgPFRhYnNDb250ZW50IHZhbHVlPVwicmVjb21tZW5kYXRpb25zXCI+XG4gICAgICAgICAgICAgIDxDYXJkPlxuICAgICAgICAgICAgICAgIDxDYXJkSGVhZGVyPlxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW5cIj5cbiAgICAgICAgICAgICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgICAgICAgICAgICA8Q2FyZFRpdGxlPkFJIFJlY29tbWVuZGF0aW9uczwvQ2FyZFRpdGxlPlxuICAgICAgICAgICAgICAgICAgICAgIDxDYXJkRGVzY3JpcHRpb24+QWN0aW9uYWJsZSBzdGVwcyB0byBpbXByb3ZlIHRoZSBkb2N1bWVudDwvQ2FyZERlc2NyaXB0aW9uPlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAge2ZlZWRiYWNrLnJlY29tbWVuZGF0aW9ucyAmJiBmZWVkYmFjay5yZWNvbW1lbmRhdGlvbnMubGVuZ3RoID4gMCAmJiAoXG4gICAgICAgICAgICAgICAgICAgICAgPEJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyaWFudD1cImdob3N0XCJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpemU9XCJzbVwiXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRleHQgPSBmZWVkYmFjay5yZWNvbW1lbmRhdGlvbnNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAubWFwKChyOiBzdHJpbmcsIGk6IG51bWJlcikgPT4gYCR7aSArIDF9LiAke3J9YClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAuam9pbihcIlxcblwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY29weVRvQ2xpcGJvYXJkKHRleHQsIFwicmVjb21tZW5kYXRpb25zXCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICB7Y29waWVkU2VjdGlvbiA9PT0gXCJyZWNvbW1lbmRhdGlvbnNcIiA/IChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8Q2hlY2sgY2xhc3NOYW1lPVwiaC00IHctNCB0ZXh0LWdyZWVuLTUwMCBtci0yXCIgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBDb3BpZWRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC8+XG4gICAgICAgICAgICAgICAgICAgICAgICApIDogKFxuICAgICAgICAgICAgICAgICAgICAgICAgICA8PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxDb3B5IGNsYXNzTmFtZT1cImgtNCB3LTQgbXItMlwiIC8+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgQ29weSBBbGxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC8+XG4gICAgICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgICAgIDwvQnV0dG9uPlxuICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPC9DYXJkSGVhZGVyPlxuICAgICAgICAgICAgICAgIDxDYXJkQ29udGVudD5cbiAgICAgICAgICAgICAgICAgIHtmZWVkYmFjay5yZWNvbW1lbmRhdGlvbnMgJiYgZmVlZGJhY2sucmVjb21tZW5kYXRpb25zLmxlbmd0aCA+IDAgPyAoXG4gICAgICAgICAgICAgICAgICAgIDxvbCBjbGFzc05hbWU9XCJzcGFjZS15LTRcIj5cbiAgICAgICAgICAgICAgICAgICAgICB7ZmVlZGJhY2sucmVjb21tZW5kYXRpb25zLm1hcCgocmVjb21tZW5kYXRpb246IHN0cmluZywgaW5kZXg6IG51bWJlcikgPT4gKFxuICAgICAgICAgICAgICAgICAgICAgICAgPGxpIGtleT17aW5kZXh9IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtc3RhcnQgZ2FwLTNcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiZmxleC1zaHJpbmstMCB3LTYgaC02IHJvdW5kZWQtZnVsbCBiZy1ibHVlLTEwMCBkYXJrOmJnLWJsdWUtOTAwIHRleHQtYmx1ZS03MDAgZGFyazp0ZXh0LWJsdWUtMzAwIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHRleHQtc20gZm9udC1zZW1pYm9sZFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtpbmRleCArIDF9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1zbGF0ZS03MDAgZGFyazp0ZXh0LXNsYXRlLTMwMCBwdC0wLjVcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7cmVjb21tZW5kYXRpb259XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvbGk+XG4gICAgICAgICAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICAgICAgICAgIDwvb2w+XG4gICAgICAgICAgICAgICAgICApIDogKFxuICAgICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXNsYXRlLTYwMCBkYXJrOnRleHQtc2xhdGUtNDAwXCI+Tm8gcmVjb21tZW5kYXRpb25zIGF2YWlsYWJsZTwvcD5cbiAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgPC9DYXJkQ29udGVudD5cbiAgICAgICAgICAgICAgPC9DYXJkPlxuICAgICAgICAgICAgPC9UYWJzQ29udGVudD5cbiAgICAgICAgICA8L1RhYnM+XG4gICAgICAgICl9XG5cbiAgICAgICAgey8qIENsYXJpZmljYXRpb24gUXVlc3Rpb25zICovfVxuICAgICAgICA8Q2FyZD5cbiAgICAgICAgICA8Q2FyZEhlYWRlcj5cbiAgICAgICAgICAgIDxDYXJkVGl0bGUgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTJcIj5cbiAgICAgICAgICAgICAgPE1lc3NhZ2VTcXVhcmUgY2xhc3NOYW1lPVwiaC01IHctNVwiIC8+XG4gICAgICAgICAgICAgIENsYXJpZmljYXRpb24gUXVlc3Rpb25zICh7cXVlc3Rpb25zLmxlbmd0aH0pXG4gICAgICAgICAgICA8L0NhcmRUaXRsZT5cbiAgICAgICAgICAgIDxDYXJkRGVzY3JpcHRpb24+UXVlc3Rpb25zIGZyb20gQUkgYW5hbHlzaXMgdGhhdCBuZWVkIHlvdXIgaW5wdXQ8L0NhcmREZXNjcmlwdGlvbj5cbiAgICAgICAgICA8L0NhcmRIZWFkZXI+XG4gICAgICAgICAgPENhcmRDb250ZW50PlxuICAgICAgICAgICAge3F1ZXN0aW9ucy5sZW5ndGggPT09IDAgPyAoXG4gICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtc2xhdGUtNjAwIGRhcms6dGV4dC1zbGF0ZS00MDBcIj5ObyBxdWVzdGlvbnMgYXZhaWxhYmxlPC9wPlxuICAgICAgICAgICAgKSA6IChcbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTZcIj5cbiAgICAgICAgICAgICAgICB7cXVlc3Rpb25zLm1hcCgocXVlc3Rpb24pID0+IChcbiAgICAgICAgICAgICAgICAgIDxkaXYga2V5PXtxdWVzdGlvbi5xdWVzdGlvbl9pZH0gY2xhc3NOYW1lPVwiYm9yZGVyIGJvcmRlci1zbGF0ZS0yMDAgZGFyazpib3JkZXItc2xhdGUtNzAwIHJvdW5kZWQtbGcgcC00XCI+XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1zdGFydCBqdXN0aWZ5LWJldHdlZW4gbWItM1wiPlxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleC0xXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yIG1iLTJcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPEJhZGdlIHZhcmlhbnQ9e2dldFByaW9yaXR5QmFkZ2VWYXJpYW50KHF1ZXN0aW9uLnByaW9yaXR5KX0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge3F1ZXN0aW9uLnByaW9yaXR5fVxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L0JhZGdlPlxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJmb250LW1lZGl1bSB0ZXh0LXNsYXRlLTkwMCBkYXJrOnRleHQtc2xhdGUtMTAwIG1iLTJcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAge3F1ZXN0aW9uLnF1ZXN0aW9uX3RleHR9XG4gICAgICAgICAgICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgICAgICAgICAgIHsvKiBFeGlzdGluZyBBbnN3ZXJzICovfVxuICAgICAgICAgICAgICAgICAgICB7cXVlc3Rpb24uYW5zd2VycyAmJiBxdWVzdGlvbi5hbnN3ZXJzLmxlbmd0aCA+IDAgJiYgKFxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibWItNCBzcGFjZS15LTJcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtc20gZm9udC1zZW1pYm9sZCB0ZXh0LXNsYXRlLTcwMCBkYXJrOnRleHQtc2xhdGUtMzAwXCI+QW5zd2Vyczo8L3A+XG4gICAgICAgICAgICAgICAgICAgICAgICB7cXVlc3Rpb24uYW5zd2Vycy5tYXAoKGFuc3dlcikgPT4gKFxuICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGtleT17YW5zd2VyLmFuc3dlcl9pZH0gY2xhc3NOYW1lPVwiYmctc2xhdGUtNTAgZGFyazpiZy1zbGF0ZS04MDAgcm91bmRlZCBwLTNcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXNtIHRleHQtc2xhdGUtNzAwIGRhcms6dGV4dC1zbGF0ZS0zMDAgbWItMVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge2Fuc3dlci5hbnN3ZXJfdGV4dH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LXNsYXRlLTUwMCBkYXJrOnRleHQtc2xhdGUtNTAwXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBieSB7YW5zd2VyLmFuc3dlcmVkX2J5X25hbWV9IG9uIHtuZXcgRGF0ZShhbnN3ZXIuYW5zd2VyZWRfYXQpLnRvTG9jYWxlU3RyaW5nKCl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9wPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICkpfVxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICApfVxuXG4gICAgICAgICAgICAgICAgICAgIHsvKiBBbnN3ZXIgSW5wdXQgKi99XG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS0yXCI+XG4gICAgICAgICAgICAgICAgICAgICAgPHRleHRhcmVhXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZT17YW5zd2VyVGV4dFtxdWVzdGlvbi5xdWVzdGlvbl9pZF0gfHwgXCJcIn1cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZSkgPT4gc2V0QW5zd2VyVGV4dCh7IC4uLmFuc3dlclRleHQsIFtxdWVzdGlvbi5xdWVzdGlvbl9pZF06IGUudGFyZ2V0LnZhbHVlIH0pfVxuICAgICAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCJUeXBlIHlvdXIgYW5zd2VyIGhlcmUuLi5cIlxuICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidy1mdWxsIHB4LTMgcHktMiBib3JkZXIgYm9yZGVyLXNsYXRlLTMwMCBkYXJrOmJvcmRlci1zbGF0ZS02MDAgcm91bmRlZC1tZCBiZy13aGl0ZSBkYXJrOmJnLXNsYXRlLTgwMCB0ZXh0LXNsYXRlLTkwMCBkYXJrOnRleHQtc2xhdGUtMTAwIGZvY3VzOm91dGxpbmUtbm9uZSBmb2N1czpyaW5nLTIgZm9jdXM6cmluZy1ibHVlLTUwMCBtaW4taC1bODBweF1cIlxuICAgICAgICAgICAgICAgICAgICAgICAgZGlzYWJsZWQ9e2lzU3VibWl0dGluZ0Fuc3dlciA9PT0gcXVlc3Rpb24ucXVlc3Rpb25faWR9XG4gICAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgICA8QnV0dG9uXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBoYW5kbGVTdWJtaXRBbnN3ZXIocXVlc3Rpb24ucXVlc3Rpb25faWQpfVxuICAgICAgICAgICAgICAgICAgICAgICAgZGlzYWJsZWQ9e2lzU3VibWl0dGluZ0Fuc3dlciA9PT0gcXVlc3Rpb24ucXVlc3Rpb25faWQgfHwgIWFuc3dlclRleHRbcXVlc3Rpb24ucXVlc3Rpb25faWRdPy50cmltKCl9XG4gICAgICAgICAgICAgICAgICAgICAgICBzaXplPVwic21cIlxuICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgIHtpc1N1Ym1pdHRpbmdBbnN3ZXIgPT09IHF1ZXN0aW9uLnF1ZXN0aW9uX2lkID8gKFxuICAgICAgICAgICAgICAgICAgICAgICAgICA8PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxMb2FkZXIyIGNsYXNzTmFtZT1cIm1yLTIgaC00IHctNCBhbmltYXRlLXNwaW5cIiAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFN1Ym1pdHRpbmcuLi5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC8+XG4gICAgICAgICAgICAgICAgICAgICAgICApIDogKFxuICAgICAgICAgICAgICAgICAgICAgICAgICBcIlN1Ym1pdCBBbnN3ZXJcIlxuICAgICAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgICA8L0J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICApfVxuICAgICAgICAgIDwvQ2FyZENvbnRlbnQ+XG4gICAgICAgIDwvQ2FyZD5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICA8L1RleHRTZWxlY3Rpb25IYW5kbGVyPlxuICApO1xufVxuIl19