"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  UploadCloud,
  XCircle,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  AlertCircle,
} from "lucide-react";

// Sample analysis data based on our real workflow results
const sampleAnalysisData = {
  documentId: "doc-1768935270455",
  submissionId: "014b7cd1-4012-408d-8e34-77ebb211e246",
  finalScore: 81,
  status: "completed",
  timestamp: "2026-01-20T18:56:34.961Z",

  scores: {
    structure: 100,
    content: 58,
    grammar: 85,
    average: 81,
  },

  criterionScores: [
    {
      name: "Party Identification",
      score: 60,
      maxScore: 100,
      assessment:
        "Parties are identified generically as 'Party A (Client)' and 'Party B (Provider)' without actual legal entity names, addresses, or registration details.",
      category: "compliance",
    },
    {
      name: "Effective Date",
      score: 30,
      maxScore: 100,
      assessment:
        "The contract references 'the date first written above' but no actual date is specified in the document.",
      category: "compliance",
    },
    {
      name: "Contract Value",
      score: 85,
      maxScore: 100,
      assessment:
        "Contract value is clearly stated as $10,000 with payment timing specified (30 days from invoice) and late payment penalty defined (1.5% per month).",
      category: "financial",
    },
    {
      name: "Terms Clarity",
      score: 55,
      maxScore: 100,
      assessment:
        "The contract contains several grammatical errors and ambiguities that reduce clarity. Multiple instances of subject-verb disagreement.",
      category: "quality",
    },
    {
      name: "Risk Assessment",
      score: 45,
      maxScore: 100,
      assessment:
        "The contract presents moderate to high risk due to incomplete party identification, missing effective date, vague scope of work.",
      category: "risk",
    },
    {
      name: "AI Contract Analysis",
      score: 52,
      maxScore: 100,
      assessment:
        "Automated analysis reveals this is a basic service agreement template with several red flags: missing effective date, undefined scope of work (Exhibit A).",
      category: "ai-analysis",
    },
    {
      name: "Reviewer Comments",
      score: 60,
      maxScore: 100,
      assessment:
        "This contract appears to be an incomplete template that requires significant refinement before execution.",
      category: "review",
    },
  ],

  structureValidation: {
    isCompliant: true,
    score: 100,
    issues: [],
    feedback:
      "The provided document matches the required structure template for a contract. All key elements such as parties, terms and conditions, and signatures are present.",
  },

  contentAnalysis: {
    score: 58,
    summary:
      "This contract scores 58/100 overall, indicating significant quality issues that must be addressed before execution. The document suffers from critical deficiencies: incomplete party identification (generic placeholders), missing effective date, undefined scope of work (non-existent Exhibit A), multiple grammatical errors, and unbalanced risk allocation.",
  },

  grammarCheck: {
    score: 85,
    errors: [
      {
        type: "punctuation",
        severity: "low",
        issue: "Missing period at the end of the first paragraph.",
        suggestion: "Add a period at the end of the first paragraph.",
      },
      {
        type: "spelling",
        severity: "low",
        issue: "The word 'informations' should be 'information'.",
        suggestion: "Change 'informations' to 'information'.",
      },
    ],
    warnings: [
      {
        type: "style",
        issue: "The use of 'shall' and 'agrees' can be more concise.",
        suggestion: "Consider using more concise language, such as 'will' and 'agrees to'.",
      },
    ],
  },

  clarificationQuestions: [
    {
      question:
        "The contract contains generic placeholders for party identification (e.g., '[Company Name]', '[Client Name]'). Should these be completed with actual party information before proceeding, or is this intentional for a template review?",
      category: "content",
      priority: "high",
      reasoning:
        "Without actual parties identified, the contract cannot be legally binding. This is the most severe deficiency affecting executability.",
    },
    {
      question:
        "The contract references 'Exhibit A' for the scope of work, but this exhibit appears to be missing or undefined. Is Exhibit A available for review, or should the scope of work be defined directly in the contract body?",
      category: "content",
      priority: "high",
      reasoning:
        "An undefined scope of work creates significant potential for disputes and makes the contract unenforceable.",
    },
    {
      question:
        "The effective date of the contract is missing. What is the intended effective date, or should this follow a specific triggering event?",
      category: "content",
      priority: "high",
      reasoning:
        "Without this, the contract's term and obligations cannot be properly determined.",
    },
    {
      question:
        "The Content Analysis notes 'unbalanced risk allocation' and 'unlimited liability exposure for the Client.' Is this intentional, or should the liability provisions be reviewed and balanced between parties?",
      category: "content",
      priority: "medium",
      reasoning:
        "Unbalanced liability provisions create significant legal and business risks. Clarification is needed on whether this reflects negotiated terms or requires revision.",
    },
  ],

  strengths: [
    "Perfect structural compliance with standard contract format including preamble, terms sections, and signature blocks",
    "Clear organizational structure with logical section headers and numbered provisions",
    "Contract value of $10,000 is clearly stated with specific payment terms (30 days) and late payment penalties (1.5% monthly)",
    "Includes basic risk mitigation elements such as indemnification clause, liability cap for Provider, and termination provisions",
    "Grammar quality is generally acceptable (85/100) with relatively minor punctuation and spelling issues",
  ],

  weaknesses: [
    "CRITICAL: Parties identified only with generic placeholders ('Party A', 'Party B') without legal names, addresses, or registration details",
    "CRITICAL: No effective date specified despite reference to one, preventing clear determination of when obligations commence",
    "CRITICAL: Scope of work references non-existent 'Exhibit A,' leaving fundamental contract purpose undefined",
    "Multiple grammatical errors including subject-verb disagreement ('Client agree'), incorrect pluralization ('informations')",
    "Unbalanced liability provisions with Provider liability capped at amount paid but Client liability unlimited",
    "Missing standard protective clauses: force majeure, dispute resolution mechanism, assignment restrictions",
  ],

  recommendations: [
    "DO NOT EXECUTE this contract in its current state - it contains critical deficiencies that create substantial legal and enforceability risks",
    "IMMEDIATE: Replace all placeholder information with actual party legal names, complete registered addresses, tax identification numbers, and authorized signatory details with titles",
    "IMMEDIATE: Insert a specific effective date in the preamble or specify the mechanism for determining effectiveness",
    "IMMEDIATE: Attach Exhibit A with detailed scope of work, deliverables, timelines, and performance standards",
    "Conduct comprehensive proofreading to correct all grammatical errors including subject-verb agreement, pluralization, and possessive forms",
    "Add complete boilerplate provisions: assignment, entire agreement, amendments, severability, waiver, and notices",
    "Balance liability provisions by either adding mutual liability caps or explicitly justifying the asymmetric allocation",
    "Include comprehensive dispute resolution mechanism specifying either mandatory arbitration, mediation, or jurisdiction/venue for litigation",
    "ESSENTIAL: Engage qualified legal counsel licensed in California to comprehensively review, complete, and refine this contract before execution",
  ],

  overallFeedback: {
    title: "Contract Analysis: NOT READY FOR EXECUTION",
    severity: "critical",
    content:
      "This contract receives an overall assessment indicating it is NOT READY FOR EXECUTION in its current form. While the document demonstrates perfect structural compliance (100/100) and acceptable grammar quality (85/100), the Content Analysis reveals critical deficiencies scoring only 58/100 that create substantial legal and business risks.",
  },
};

export default function Home() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [showResults, setShowResults] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      // Simulate processing
      setTimeout(() => setShowResults(true), 1500);
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

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-50 mb-2">
            Overlay Platform
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            AI-Powered Document Analysis & Evaluation
          </p>
        </div>

        {/* Upload Section */}
        {!showResults && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UploadCloud className="h-5 w-5" />
                Upload Document for Analysis
              </CardTitle>
              <CardDescription>
                Upload a contract or document to receive comprehensive AI-powered analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-12 text-center hover:border-slate-400 dark:hover:border-slate-600 transition-colors">
                <input
                  type="file"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                  accept=".txt,.pdf,.docx"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                  <p className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    PDF, DOCX, or TXT (max 10MB)
                  </p>
                </label>
              </div>
              {uploadedFile && (
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Processing: {uploadedFile.name}
                  </p>
                  <Progress value={75} className="mt-2" />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Results Section */}
        {showResults && (
          <>
            {/* Overall Score Card */}
            <Card className="mb-8 border-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl mb-2">Overall Analysis Score</CardTitle>
                    <CardDescription>
                      Submission ID: {sampleAnalysisData.submissionId}
                    </CardDescription>
                  </div>
                  <div className="text-center">
                    <div className={`text-6xl font-bold ${getScoreColor(sampleAnalysisData.finalScore)}`}>
                      {sampleAnalysisData.finalScore}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">out of 100</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Critical Alert */}
                <Alert variant="destructive" className="mb-6">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{sampleAnalysisData.overallFeedback.title}</AlertTitle>
                  <AlertDescription className="mt-2">
                    {sampleAnalysisData.overallFeedback.content}
                  </AlertDescription>
                </Alert>

                {/* Score Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        Structure
                      </span>
                      <Badge variant={getScoreBadgeVariant(sampleAnalysisData.scores.structure)}>
                        {sampleAnalysisData.scores.structure}%
                      </Badge>
                    </div>
                    <Progress value={sampleAnalysisData.scores.structure} className="h-2" />
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        Content
                      </span>
                      <Badge variant={getScoreBadgeVariant(sampleAnalysisData.scores.content)}>
                        {sampleAnalysisData.scores.content}%
                      </Badge>
                    </div>
                    <Progress value={sampleAnalysisData.scores.content} className="h-2" />
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        Grammar
                      </span>
                      <Badge variant={getScoreBadgeVariant(sampleAnalysisData.scores.grammar)}>
                        {sampleAnalysisData.scores.grammar}%
                      </Badge>
                    </div>
                    <Progress value={sampleAnalysisData.scores.grammar} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Detailed Analysis Tabs */}
            <Tabs defaultValue="criteria" className="mb-8">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="criteria">Criteria Scores</TabsTrigger>
                <TabsTrigger value="questions">
                  Clarifications ({sampleAnalysisData.clarificationQuestions.length})
                </TabsTrigger>
                <TabsTrigger value="strengths">Strengths</TabsTrigger>
                <TabsTrigger value="weaknesses">Weaknesses</TabsTrigger>
                <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
              </TabsList>

              {/* Criteria Scores Tab */}
              <TabsContent value="criteria">
                <Card>
                  <CardHeader>
                    <CardTitle>Detailed Criterion Scores</CardTitle>
                    <CardDescription>
                      {sampleAnalysisData.criterionScores.length} evaluation criteria analyzed by AI
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[600px] pr-4">
                      <div className="space-y-6">
                        {sampleAnalysisData.criterionScores.map((criterion, index) => (
                          <div key={index} className="border-b border-slate-200 dark:border-slate-700 pb-6 last:border-0">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <h4 className="font-semibold text-lg mb-1">{criterion.name}</h4>
                                <Badge variant="outline" className="text-xs">
                                  {criterion.category}
                                </Badge>
                              </div>
                              <div className="text-right ml-4">
                                <div className={`text-3xl font-bold ${getScoreColor(criterion.score)}`}>
                                  {criterion.score}
                                </div>
                                <div className="text-xs text-slate-500">/ {criterion.maxScore}</div>
                              </div>
                            </div>
                            <Progress value={(criterion.score / criterion.maxScore) * 100} className="mb-3 h-2" />
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              {criterion.assessment}
                            </p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Clarification Questions Tab */}
              <TabsContent value="questions">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Clarification Questions
                    </CardTitle>
                    <CardDescription>
                      Critical questions that need to be addressed before proceeding
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {sampleAnalysisData.clarificationQuestions.map((question, index) => (
                        <Alert key={index} variant={question.priority === "high" ? "destructive" : "default"}>
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle className="flex items-center justify-between">
                            <span>Question {index + 1}</span>
                            <div className="flex gap-2">
                              <Badge variant={getPriorityBadgeVariant(question.priority)}>
                                {question.priority}
                              </Badge>
                              <Badge variant="outline">{question.category}</Badge>
                            </div>
                          </AlertTitle>
                          <AlertDescription className="mt-3">
                            <p className="font-medium mb-2">{question.question}</p>
                            <p className="text-sm text-slate-600 dark:text-slate-400 italic">
                              Reasoning: {question.reasoning}
                            </p>
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Strengths Tab */}
              <TabsContent value="strengths">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                      Document Strengths
                    </CardTitle>
                    <CardDescription>Positive aspects identified in the analysis</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {sampleAnalysisData.strengths.map((strength, index) => (
                        <li key={index} className="flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                          <span className="text-slate-700 dark:text-slate-300">{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Weaknesses Tab */}
              <TabsContent value="weaknesses">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingDown className="h-5 w-5 text-red-600" />
                      Document Weaknesses
                    </CardTitle>
                    <CardDescription>Issues and deficiencies requiring attention</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {sampleAnalysisData.weaknesses.map((weakness, index) => (
                        <li key={index} className="flex items-start gap-3">
                          <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                          <span className="text-slate-700 dark:text-slate-300">
                            {weakness.startsWith("CRITICAL") ? (
                              <span className="font-semibold text-red-600">{weakness}</span>
                            ) : (
                              weakness
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Recommendations Tab */}
              <TabsContent value="recommendations">
                <Card>
                  <CardHeader>
                    <CardTitle>AI Recommendations</CardTitle>
                    <CardDescription>
                      Actionable steps to improve the document before execution
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ol className="space-y-4">
                      {sampleAnalysisData.recommendations.map((recommendation, index) => (
                        <li key={index} className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center text-sm font-semibold">
                            {index + 1}
                          </span>
                          <span className="text-slate-700 dark:text-slate-300 pt-0.5">
                            {recommendation.startsWith("DO NOT") || recommendation.startsWith("IMMEDIATE") || recommendation.startsWith("ESSENTIAL") ? (
                              <span className="font-semibold text-red-600">{recommendation}</span>
                            ) : (
                              recommendation
                            )}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Grammar & Structure Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Structure Validation */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {sampleAnalysisData.structureValidation.isCompliant ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    Structure Validation
                  </CardTitle>
                  <CardDescription>
                    Score: {sampleAnalysisData.structureValidation.score}/100
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge
                    variant={sampleAnalysisData.structureValidation.isCompliant ? "default" : "destructive"}
                    className="mb-4"
                  >
                    {sampleAnalysisData.structureValidation.isCompliant ? "Compliant" : "Non-Compliant"}
                  </Badge>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {sampleAnalysisData.structureValidation.feedback}
                  </p>
                  {sampleAnalysisData.structureValidation.issues.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold mb-2">Issues Found:</h4>
                      <ul className="space-y-1">
                        {sampleAnalysisData.structureValidation.issues.map((issue, index) => (
                          <li key={index} className="text-sm text-red-600">
                            • {issue}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Grammar Check */}
              <Card>
                <CardHeader>
                  <CardTitle>Grammar & Writing Quality</CardTitle>
                  <CardDescription>
                    Score: {sampleAnalysisData.grammarCheck.score}/100
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {sampleAnalysisData.grammarCheck.errors.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-600" />
                          Errors ({sampleAnalysisData.grammarCheck.errors.length})
                        </h4>
                        <ul className="space-y-2">
                          {sampleAnalysisData.grammarCheck.errors.map((error, index) => (
                            <li key={index} className="text-sm border-l-2 border-red-400 pl-3">
                              <Badge variant="outline" className="text-xs mb-1">
                                {error.type}
                              </Badge>
                              <p className="text-slate-600 dark:text-slate-400">{error.issue}</p>
                              <p className="text-green-700 dark:text-green-400 text-xs mt-1">
                                → {error.suggestion}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {sampleAnalysisData.grammarCheck.warnings.length > 0 && (
                      <div>
                        <Separator className="my-4" />
                        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                          Warnings ({sampleAnalysisData.grammarCheck.warnings.length})
                        </h4>
                        <ul className="space-y-2">
                          {sampleAnalysisData.grammarCheck.warnings.map((warning, index) => (
                            <li key={index} className="text-sm border-l-2 border-yellow-400 pl-3">
                              <Badge variant="outline" className="text-xs mb-1">
                                {warning.type}
                              </Badge>
                              <p className="text-slate-600 dark:text-slate-400">{warning.issue}</p>
                              <p className="text-blue-700 dark:text-blue-400 text-xs mt-1">
                                → {warning.suggestion}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Action Buttons */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                      Analysis completed on {new Date(sampleAnalysisData.timestamp).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-500">
                      Document ID: {sampleAnalysisData.documentId}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setShowResults(false)}>
                      Analyze Another Document
                    </Button>
                    <Button>Download Full Report</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
