# Overlay Platform - Data Flow

**Last Updated**: January 25, 2026 (v1.1)
**Related**: `00_SYSTEM_OVERVIEW.md`, `05_LLM_ORCHESTRATION.md`

---

## Overview

This document describes how data flows through the Overlay Platform from user input to AI-generated feedback display. It covers three main workflows:

1. **File Upload Flow** - User uploads PDF/DOCX/DOC/TXT file
2. **Paste Text Flow** - User pastes text directly (v1.1 feature)
3. **Feedback Retrieval Flow** - User views AI-generated feedback

---

## Flow 1: File Upload Submission

### User Journey

```
User selects session
  → Clicks "Upload File" tab
  → Selects file (PDF/DOCX/DOC/TXT)
  → Clicks "Upload Document"
  → Frontend converts file to base64
  → POST /submissions
  → Waits ~2.5 minutes for AI analysis
  → Views feedback (scores, strengths, weaknesses, recommendations)
```

### Detailed Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│ STAGE 1: FRONTEND (Browser)                                             │
└─────────────────────────────────────────────────────────────────────────┘

User Action: Select file from file system
  │
  ▼
FileReader API: Convert file to base64
  │
  ├─ Read file as ArrayBuffer
  ├─ Convert to base64 string
  └─ Calculate file size (bytes)
  │
  ▼
Validation:
  ├─ Check file size (max 10MB)
  ├─ Check file type (.pdf, .docx, .doc, .txt)
  └─ Validate session ID and overlay ID
  │
  ▼
API Call: POST /submissions
  │
  ├─ Headers:
  │   ├─ Authorization: Bearer {JWT_TOKEN}
  │   └─ Content-Type: application/json
  │
  └─ Body:
      ├─ session_id: UUID
      ├─ overlay_id: UUID
      ├─ document_name: "example.pdf"
      ├─ document_content: "base64EncodedString..."
      ├─ file_size: 102400 (bytes)
      └─ is_pasted_text: false

┌─────────────────────────────────────────────────────────────────────────┐
│ STAGE 2: API GATEWAY                                                     │
└─────────────────────────────────────────────────────────────────────────┘

API Gateway receives request
  │
  ▼
Cognito Authorizer validates JWT token
  │
  ├─ Extract user ID from token (sub claim)
  ├─ Verify token signature
  ├─ Check token expiration
  └─ Return user ID to Lambda
  │
  ▼
Route to Lambda: overlay-api-submissions
  │
  └─ Event:
      ├─ httpMethod: "POST"
      ├─ path: "/submissions"
      ├─ body: "{...submission data...}"
      └─ requestContext:
          └─ authorizer:
              └─ claims:
                  └─ sub: "user-uuid"

┌─────────────────────────────────────────────────────────────────────────┐
│ STAGE 3: SUBMISSIONS LAMBDA                                              │
│ File: lambda/functions/api/submissions/index.js                         │
└─────────────────────────────────────────────────────────────────────────┘

Handler: handleCreate() (line 97)
  │
  ▼
Parse Request Body
  │
  ├─ overlay_id: UUID
  ├─ session_id: UUID
  ├─ document_name: "example.pdf"
  ├─ document_content: base64 string
  ├─ file_size: number
  └─ is_pasted_text: false
  │
  ▼
Content Type Detection (lines 112-122)
  │
  ├─ If is_pasted_text: "text/plain"
  ├─ If document_name.endsWith('.docx'): "application/vnd.openxmlformats-..."
  ├─ If document_name.endsWith('.doc'): "application/msword"
  ├─ If document_name.endsWith('.txt'): "text/plain"
  └─ Else: "application/pdf" (default)
  │
  ▼
S3 Upload (lines 127-138)
  │
  ├─ Bucket: "overlay-docs-{account-id}"
  ├─ Key: "submissions/{user_id}/{timestamp}-{filename}"
  ├─ ContentType: (detected above)
  ├─ Body: Buffer.from(document_content, 'base64')
  └─ ServerSideEncryption: 'AES256'
  │
  ▼
Database Insert (lines 143-158)
  │
  ├─ Table: document_submissions
  ├─ Columns:
  │   ├─ session_id: UUID
  │   ├─ overlay_id: UUID
  │   ├─ document_name: string
  │   ├─ s3_bucket: string
  │   ├─ s3_key: string
  │   ├─ file_size: bigint
  │   ├─ content_type: string
  │   ├─ submitted_by: UUID (user_id)
  │   ├─ status: 'submitted'
  │   └─ ai_analysis_status: 'pending'
  │
  └─ Returns: submission_id (UUID)
  │
  ▼
⭐ Trigger Step Functions Workflow (lines 163-181)
  │
  ├─ Check environment variable: WORKFLOW_STATE_MACHINE_ARN
  │   └─ Value: "arn:aws:states:eu-west-1:...overlay-document-analysis"
  │
  ├─ Build Step Functions Input:
  │   ├─ documentId: submission_id (⚠️ CRITICAL - was missing in initial release)
  │   ├─ submissionId: submission_id
  │   ├─ s3Bucket: "overlay-docs-{account-id}"
  │   ├─ s3Key: "submissions/{user_id}/{timestamp}-{filename}"
  │   └─ overlayId: overlay_id
  │
  ├─ Call AWS Step Functions API:
  │   └─ StartExecutionCommand({
  │       stateMachineArn: WORKFLOW_STATE_MACHINE_ARN,
  │       input: JSON.stringify(input)
  │     })
  │
  └─ Log: "Started AI workflow for submission {submission_id}"
  │
  ▼
Return Response: 201 Created
  │
  └─ Body:
      ├─ submission_id: UUID
      ├─ document_name: string
      ├─ status: "submitted"
      ├─ ai_analysis_status: "pending"
      └─ submitted_at: timestamp

┌─────────────────────────────────────────────────────────────────────────┐
│ STAGE 4: STEP FUNCTIONS WORKFLOW                                        │
│ See: 05_LLM_ORCHESTRATION.md for detailed workflow                      │
└─────────────────────────────────────────────────────────────────────────┘

Step Functions receives Start Execution request
  │
  ▼
State 1: Structure Validation (~30s)
  │
  ├─ Lambda: overlay-structure-validator
  ├─ Input: {documentId, submissionId, s3Bucket, s3Key, overlayId}
  ├─ Process:
  │   ├─ Fetch document from S3
  │   ├─ Extract text (mammoth for DOCX, pdf-parse for PDF, UTF-8 for TXT)
  │   ├─ Get overlay criteria from database
  │   ├─ Call Claude API to validate structure
  │   └─ Return structure analysis
  │
  └─ Output: {structureScore, structureAnalysis, documentText, criteria}
  │
  ▼
State 2: Content Analysis (~45s)
  │
  ├─ Lambda: overlay-content-analyzer
  ├─ Input: Previous output + documentId
  ├─ Process:
  │   ├─ Use documentText from previous step
  │   ├─ Use criteria from previous step
  │   ├─ Call Claude API to analyze content against criteria
  │   └─ Return content analysis
  │
  └─ Output: {contentScore, contentAnalysis, criterionScores}
  │
  ▼
State 3: Grammar Check (~30s)
  │
  ├─ Lambda: overlay-grammar-checker
  ├─ Input: Previous output + documentId
  ├─ Process:
  │   ├─ Use documentText from State 1
  │   ├─ Call Claude API to check grammar and style
  │   └─ Return grammar analysis
  │
  └─ Output: {grammarScore, grammarAnalysis, issues}
  │
  ▼
State 4: Clarification Questions (~30s)
  │
  ├─ Lambda: overlay-clarification
  ├─ Input: Previous output + documentId
  ├─ Process:
  │   ├─ Use documentText and criteria
  │   ├─ Call Claude API to generate clarification questions
  │   ├─ Save questions to database (clarification_questions table)
  │   └─ Return questions
  │
  └─ Output: {questions: Array<{question, priority, context}>}
  │
  ▼
⭐ State 5: Scoring (~15s) - FINAL STEP
  │
  ├─ Lambda: overlay-scoring
  ├─ Input: All previous outputs
  ├─ Process:
  │   ├─ Calculate weighted average score
  │   ├─ Generate comprehensive feedback (strengths, weaknesses, recommendations)
  │   ├─ Call Claude API to synthesize final feedback
  │   ├─ ⭐ Save to feedback_reports table (NOT ai_agent_results!)
  │   │   ├─ Table: feedback_reports
  │   │   ├─ Columns:
  │   │   │   ├─ report_id: UUID
  │   │   │   ├─ submission_id: UUID
  │   │   │   ├─ report_type: 'comment' (AI-generated)
  │   │   │   ├─ title: "AI Analysis Report"
  │   │   │   ├─ content: JSON.stringify({
  │   │   │   │   summary: "Overall analysis...",
  │   │   │   │   strengths: ["...", "..."],
  │   │   │   │   weaknesses: ["...", "..."],
  │   │   │   │   recommendations: ["...", "..."],
  │   │   │   │   scores: {
  │   │   │   │     structure: 95,
  │   │   │   │     content: 78,
  │   │   │   │     grammar: 92,
  │   │   │   │     average: 85
  │   │   │   │   }
  │   │   │   │ })
  │   │   │   └─ severity: 'medium'
  │   │   │
  │   │   └─ ⚠️ CRITICAL LESSON: Initially tried to query ai_agent_results
  │   │       but scoring agent saves to feedback_reports!
  │   │       Fixed in v1.1 (see SQL_COLUMN_FIX.md)
  │   │
  │   ├─ Save criterion scores to evaluation_responses table
  │   │   ├─ Table: evaluation_responses
  │   │   ├─ Columns:
  │   │   │   ├─ response_id: UUID
  │   │   │   ├─ submission_id: UUID
  │   │   │   ├─ criteria_id: UUID (⚠️ NOT criterion_id! Fixed in v1.1)
  │   │   │   ├─ response_value: JSONB
  │   │   │   ├─ score: decimal
  │   │   │   └─ is_ai_generated: true
  │   │   │
  │   │   └─ One row per evaluation criterion
  │   │
  │   └─ Update submission status to 'approved' / 'completed'
  │
  └─ Output: {finalScore, feedback, reportId}
  │
  ▼
Step Functions execution completes
  │
  └─ Status: SUCCEEDED (or FAILED if any retries exhausted)

┌─────────────────────────────────────────────────────────────────────────┐
│ STAGE 5: FRONTEND POLLING (Every 10 seconds)                            │
└─────────────────────────────────────────────────────────────────────────┘

Frontend useEffect hook runs every 10 seconds
  │
  ▼
API Call: GET /submissions/{id}
  │
  ├─ Response:
  │   ├─ submission_id: UUID
  │   ├─ document_name: string
  │   ├─ status: "submitted" | "approved" | "rejected"
  │   ├─ ai_analysis_status: "pending" | "in_progress" | "completed" | "failed"
  │   └─ submitted_at: timestamp
  │
  └─ If ai_analysis_status === "completed":
      └─ Navigate to /submission/{id} page (or stay if already there)
  │
  ▼
API Call: GET /submissions/{id}/feedback
  │
  ├─ Endpoint: lambda/functions/api/submissions/index.js (line 329)
  │
  ├─ Query 1: Fetch feedback from feedback_reports table
  │   ├─ SELECT report_id, content, title, severity, created_at
  │   ├─ FROM feedback_reports
  │   ├─ WHERE submission_id = $1 AND report_type = 'comment'
  │   └─ ORDER BY created_at DESC LIMIT 1
  │
  ├─ Parse JSON content:
  │   ├─ overall_score: feedbackContent.scores?.average
  │   ├─ strengths: feedbackContent.strengths
  │   ├─ weaknesses: feedbackContent.weaknesses
  │   ├─ recommendations: feedbackContent.recommendations
  │   └─ detailed_feedback: feedbackContent.summary
  │
  ├─ Query 2: Fetch criterion scores from evaluation_responses table
  │   ├─ SELECT er.criteria_id, ec.name, er.score, er.response_value
  │   ├─ FROM evaluation_responses er
  │   ├─ JOIN evaluation_criteria ec ON er.criteria_id = ec.criteria_id
  │   ├─ WHERE er.submission_id = $1
  │   └─ ORDER BY ec.display_order, ec.name
  │
  └─ Response: 200 OK
      ├─ submission_id: UUID
      ├─ overall_score: 85
      ├─ strengths: ["Clear structure...", "..."]
      ├─ weaknesses: ["Limited evidence...", "..."]
      ├─ recommendations: ["Add citations...", "..."]
      ├─ detailed_feedback: "This document demonstrates..."
      ├─ criterion_scores: [
      │   {
      │     criterion_id: UUID,
      │     criterion_name: "Market Analysis",
      │     score: 85,
      │     weight: 0.25
      │   },
      │   ...
      │ ]
      └─ generated_at: timestamp
  │
  ▼
Frontend renders feedback
  │
  ├─ Overall score: 85/100 (progress bar)
  ├─ Strengths: Bulleted list
  ├─ Weaknesses: Bulleted list
  ├─ Recommendations: Numbered list
  └─ Criterion scores: Table with scores and weights
```

---

## Flow 2: Paste Text Submission (v1.1 Feature)

### User Journey

```
User selects session
  → Clicks "Paste Text" tab
  → Pastes document text into textarea
  → Sees real-time character counter
  → Clicks "Submit Text"
  → Frontend converts text to base64
  → POST /submissions (with is_pasted_text: true)
  → Same AI workflow as file upload
  → Views feedback
```

### Key Differences from File Upload

```
┌─────────────────────────────────────────────────────────────────────────┐
│ FRONTEND DIFFERENCES                                                     │
└─────────────────────────────────────────────────────────────────────────┘

Input Source:
  ├─ File Upload: FileReader API reads file from file system
  └─ Paste Text: User types/pastes into <textarea> component
  │
  ▼
Base64 Encoding:
  ├─ File Upload: FileReader.readAsArrayBuffer() → Buffer.toString('base64')
  └─ Paste Text: btoa(pastedText) (JavaScript built-in)
  │
  ▼
File Size Calculation:
  ├─ File Upload: file.size (from File object)
  └─ Paste Text: new Blob([pastedText]).size (JavaScript built-in)
  │
  ▼
API Request Body:
  ├─ Shared Fields:
  │   ├─ session_id: UUID
  │   ├─ overlay_id: UUID
  │   ├─ document_content: base64 string
  │   └─ file_size: number (bytes)
  │
  ├─ File Upload:
  │   ├─ document_name: "example.pdf" (original filename)
  │   └─ is_pasted_text: false (or omitted)
  │
  └─ Paste Text:
      ├─ document_name: "pasted-text.txt" (hardcoded)
      └─ is_pasted_text: true ⭐ (NEW FLAG)

┌─────────────────────────────────────────────────────────────────────────┐
│ BACKEND DIFFERENCES                                                      │
└─────────────────────────────────────────────────────────────────────────┘

Content Type Detection (line 112):
  │
  ├─ If is_pasted_text === true:
  │   └─ contentType = 'text/plain'
  │
  └─ Else: Detect from file extension (as in File Upload)
  │
  ▼
S3 Storage:
  │
  ├─ File Upload Key: "submissions/{user_id}/{timestamp}-{filename}"
  │   └─ Example: "submissions/.../1769380773185-example.pdf"
  │
  └─ Paste Text Key: "submissions/{user_id}/{timestamp}-pasted-text.txt"
      └─ Example: "submissions/.../1769381010311-pasted-text.txt"
  │
  ▼
⭐ CRITICAL: Same AI Workflow!
  │
  ├─ Both trigger Step Functions with identical input format
  ├─ Step Functions doesn't know or care if it was uploaded or pasted
  ├─ Text extraction handles content_type = 'text/plain' automatically
  └─ Results saved to same feedback_reports table
```

### Text Extraction in AI Agents

```javascript
// File: lambda/layers/common/nodejs/db-utils.js (lines 310-351)

async function getDocumentFromS3(s3Bucket, s3Key) {
  // Fetch document from S3
  const s3Object = await s3.send(new GetObjectCommand({
    Bucket: s3Bucket,
    Key: s3Key,
  }));

  const buffer = await streamToBuffer(s3Object.Body);
  const fileExtension = s3Key.split('.').pop().toLowerCase();

  // ⭐ TEXT EXTRACTION LOGIC
  if (fileExtension === 'txt') {
    // ✅ Pasted text OR uploaded .txt file
    return buffer.toString('utf-8');

  } else if (fileExtension === 'docx') {
    // ✅ Uploaded .docx file
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value;

  } else if (fileExtension === 'doc') {
    // ✅ Uploaded .doc file (older Word format)
    // Fallback: Use mammoth or return raw text
    return buffer.toString('utf-8');

  } else if (fileExtension === 'pdf') {
    // ✅ Uploaded PDF file
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return data.text;

  } else {
    // ❌ Unsupported format
    throw new Error(`Unsupported file format: ${fileExtension}`);
  }
}
```

**Key Insight**: Pasted text is treated as a `.txt` file, so it uses the same text extraction logic as uploaded text files. No special handling needed!

---

## Flow 3: Feedback Retrieval

### User Journey

```
User navigates to submission detail page
  → Frontend makes two API calls:
      1. GET /submissions/{id} (status check)
      2. GET /submissions/{id}/feedback (fetch feedback)
  → Frontend renders feedback
  → User can answer clarification questions
```

### Detailed Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ FRONTEND REQUEST                                                         │
└─────────────────────────────────────────────────────────────────────────┘

useEffect(() => {
  // Check if analysis is complete
  const checkStatus = async () => {
    const submission = await apiClient.getSubmission(submissionId);

    if (submission.ai_analysis_status === 'completed') {
      // Fetch feedback
      const feedback = await apiClient.getSubmissionFeedback(submissionId);
      setFeedback(feedback);
      // Stop polling
      clearInterval(intervalId);
    }
  };

  // Poll every 10 seconds
  const intervalId = setInterval(checkStatus, 10000);
  checkStatus(); // Run immediately

  return () => clearInterval(intervalId);
}, [submissionId]);

┌─────────────────────────────────────────────────────────────────────────┐
│ BACKEND: handleGetFeedback() (lines 322-395)                            │
│ File: lambda/functions/api/submissions/index.js                         │
└─────────────────────────────────────────────────────────────────────────┘

Step 1: Query feedback_reports table
  │
  ├─ SQL:
  │   SELECT report_id, content, title, severity, created_at
  │   FROM feedback_reports
  │   WHERE submission_id = $1 AND report_type = 'comment'
  │   ORDER BY created_at DESC
  │   LIMIT 1
  │
  ├─ ⚠️ LESSON LEARNED: Initially queried ai_agent_results table
  │   │
  │   ├─ Problem: ai_agent_results table was empty
  │   │   └─ Scoring agent saves to feedback_reports, not ai_agent_results!
  │   │
  │   ├─ Fix (v1.1, 22:34:50 UTC):
  │   │   └─ Changed query to feedback_reports table
  │   │
  │   └─ Documentation: FEEDBACK_DISPLAY_FIX.md
  │
  └─ Result:
      ├─ report_id: UUID
      ├─ content: "{\"summary\":\"...\",\"strengths\":[...],\"scores\":{...}}"
      ├─ title: "AI Analysis Report"
      ├─ severity: "medium"
      └─ created_at: timestamp
  │
  ▼
Step 2: Parse JSON content
  │
  ├─ JavaScript:
  │   const feedbackContent = JSON.parse(scoringResult.rows[0].content);
  │
  └─ Extracted fields:
      ├─ feedbackContent.scores.average → overall_score
      ├─ feedbackContent.strengths → strengths array
      ├─ feedbackContent.weaknesses → weaknesses array
      ├─ feedbackContent.recommendations → recommendations array
      └─ feedbackContent.summary → detailed_feedback
  │
  ▼
Step 3: Query evaluation_responses table for criterion scores
  │
  ├─ SQL (FIXED in v1.1, 23:03:52 UTC):
  │   SELECT
  │     er.response_id,
  │     er.criteria_id,          -- ✅ FIXED: Was er.criterion_id
  │     ec.name as criterion_name,
  │     ec.description as criterion_description,
  │     ec.criterion_type,
  │     ec.weight,
  │     er.response_value,
  │     er.score,                -- ✅ FIXED: Removed er.feedback (doesn't exist)
  │     er.created_at
  │   FROM evaluation_responses er
  │   JOIN evaluation_criteria ec ON er.criteria_id = ec.criteria_id
  │   WHERE er.submission_id = $1
  │   ORDER BY ec.display_order, ec.name
  │
  ├─ ⚠️ LESSON LEARNED: Column name mismatch caused 500 errors
  │   │
  │   ├─ Problem: Query used er.criterion_id but column is criteria_id
  │   │   └─ Also referenced non-existent er.feedback column
  │   │
  │   ├─ Fix (v1.1, 23:03:52 UTC):
  │   │   ├─ Changed er.criterion_id → er.criteria_id
  │   │   ├─ Changed JOIN condition to use criteria_id
  │   │   └─ Removed er.feedback column reference
  │   │
  │   └─ Documentation: SQL_COLUMN_FIX.md
  │
  └─ Result: Array of criterion scores
      ├─ [{criteria_id: UUID, score: 85, weight: 0.25}, ...]
  │
  ▼
Step 4: Build complete feedback response
  │
  └─ Return:
      ├─ submission_id: UUID
      ├─ overall_score: 85
      ├─ strengths: ["...", "..."]
      ├─ weaknesses: ["...", "..."]
      ├─ recommendations: ["...", "..."]
      ├─ detailed_feedback: "This document..."
      ├─ criterion_scores: [{...}, {...}]
      └─ generated_at: timestamp

┌─────────────────────────────────────────────────────────────────────────┐
│ FRONTEND RENDERING                                                       │
└─────────────────────────────────────────────────────────────────────────┘

Submission Detail Page renders:
  │
  ├─ Header:
  │   ├─ Document name
  │   ├─ Submission date
  │   └─ Status badges ("approved", "completed")
  │
  ├─ Overall Analysis Score:
  │   ├─ Score display: "85/100"
  │   └─ Progress bar (green if >= 80, yellow if >= 60, red if < 60)
  │
  ├─ Strengths Section:
  │   └─ Bulleted list of strengths
  │
  ├─ Weaknesses Section:
  │   └─ Bulleted list of weaknesses
  │
  ├─ Recommendations Section:
  │   └─ Numbered list of recommendations
  │
  ├─ Detailed Feedback:
  │   └─ Multi-paragraph analysis
  │
  └─ Criterion Scores Table:
      └─ Table with columns: Criterion Name, Score, Weight
```

---

## Data States and Transitions

### Submission Status Flow

```
┌──────────┐
│submitted │  ← Initial state after POST /submissions
└────┬─────┘
     │
     │ Step Functions workflow starts
     │
     ├─────────┐
     │         ▼
     │  ┌────────────┐
     │  │in_progress │  ← Set by Step Functions (optional)
     │  └────┬───────┘
     │       │
     ├───────┘
     │
     │ Workflow completes successfully
     │
     ▼
┌─────────┐
│approved │  ← Final state set by scoring agent
└─────────┘

     OR

┌──────────┐
│submitted │
└────┬─────┘
     │
     │ Workflow fails (max retries exhausted)
     │
     ▼
┌─────────┐
│rejected │  ← Error state
└─────────┘
```

### AI Analysis Status Flow

```
┌────────┐
│pending │  ← Initial state after POST /submissions
└────┬───┘
     │
     │ Step Functions workflow starts
     │
     ▼
┌────────────┐
│in_progress │  ← Set when first agent starts
└────┬───────┘
     │
     │ All agents complete successfully
     │
     ▼
┌──────────┐
│completed │  ← Final state set by scoring agent
└──────────┘

     OR

┌────────┐
│pending │
└────┬───┘
     │
     │ Workflow fails
     │
     ▼
┌───────┐
│failed │  ← Error state
└───────┘
```

### Frontend Display States

```
┌──────────────────────────────────────────────────────────────────────────┐
│ UI State Based on ai_analysis_status                                     │
└──────────────────────────────────────────────────────────────────────────┘

if (ai_analysis_status === 'pending') {
  // Show: Loading spinner + "Analysis starting..."
  // Action: Poll GET /submissions/{id} every 10 seconds
}

else if (ai_analysis_status === 'in_progress') {
  // Show: Progress bar + "AI agents analyzing document..."
  // Action: Continue polling every 10 seconds
}

else if (ai_analysis_status === 'completed') {
  // Show: Full feedback (scores, strengths, weaknesses, recommendations)
  // Action: Stop polling, fetch GET /submissions/{id}/feedback
}

else if (ai_analysis_status === 'failed') {
  // Show: Error message + "Contact support"
  // Action: Stop polling
}
```

---

## Data Transformations

### 1. File to Text Extraction

```
Input: Binary file (PDF/DOCX/DOC/TXT)
  │
  ├─ PDF:
  │   └─ pdf-parse library
  │       ├─ Parses PDF structure
  │       ├─ Extracts text from pages
  │       └─ Returns: { text: "...", numPages: 10 }
  │
  ├─ DOCX:
  │   └─ mammoth library
  │       ├─ Parses Open XML structure
  │       ├─ Extracts text from paragraphs
  │       └─ Returns: { value: "...", messages: [] }
  │
  ├─ DOC (older Word format):
  │   └─ Fallback: UTF-8 decode (may have formatting artifacts)
  │
  └─ TXT / Pasted Text:
      └─ Direct UTF-8 decode: buffer.toString('utf-8')
  │
  ▼
Output: Plain text string (ready for AI analysis)
```

### 2. AI Analysis to Structured Feedback

```
Input: Plain text + evaluation criteria
  │
  ▼
Claude API Request:
  ├─ Prompt includes:
  │   ├─ Document text
  │   ├─ Evaluation criteria (name, description, weight, max_score)
  │   ├─ Overlay context (purpose, when_used, process_context, target_audience)
  │   └─ Instructions for scoring
  │
  ├─ Model: claude-sonnet-4-5-20250929
  ├─ Temperature: 0.0 (deterministic)
  └─ Max tokens: 4096
  │
  ▼
Claude API Response:
  ├─ JSON format:
  │   {
  │     "overallFeedback": {
  │       "title": "AI Analysis Report",
  │       "content": "This document demonstrates...",
  │       "strengths": [
  │         "Clear structure and organization",
  │         "Comprehensive market analysis",
  │         ...
  │       ],
  │       "weaknesses": [
  │         "Limited competitive analysis",
  │         "Missing financial projections",
  │         ...
  │       ],
  │       "recommendations": [
  │         "Add detailed competitor comparison",
  │         "Include 3-year financial forecast",
  │         ...
  │       ],
  │       "severity": "medium"
  │     },
  │     "criterionScores": [
  │       {
  │         "criterionName": "Market Analysis",
  │         "criterionId": "uuid",
  │         "score": 85,
  │         "reasoning": "Strong market research..."
  │       },
  │       ...
  │     ]
  │   }
  │
  └─ Parse JSON and extract fields
  │
  ▼
Database Storage:
  ├─ feedback_reports table:
  │   ├─ report_id: UUID (generated)
  │   ├─ submission_id: UUID
  │   ├─ report_type: 'comment'
  │   ├─ title: "AI Analysis Report"
  │   ├─ content: JSON.stringify({
  │   │   summary: overallFeedback.content,
  │   │   strengths: overallFeedback.strengths,
  │   │   weaknesses: overallFeedback.weaknesses,
  │   │   recommendations: overallFeedback.recommendations,
  │   │   scores: {
  │   │     structure: 95,
  │   │     content: 78,
  │   │     grammar: 92,
  │   │     average: 85
  │   │   }
  │   │ })
  │   └─ severity: 'medium'
  │
  └─ evaluation_responses table (one row per criterion):
      ├─ response_id: UUID (generated)
      ├─ submission_id: UUID
      ├─ criteria_id: UUID
      ├─ response_value: JSONB {reasoning: "..."}
      ├─ score: 85.00
      └─ is_ai_generated: true
```

### 3. Database to API Response

```
Input: Database rows from feedback_reports and evaluation_responses
  │
  ▼
Query Results:
  ├─ feedback_reports row:
  │   ├─ report_id: UUID
  │   ├─ content: "{\"summary\":\"...\",\"scores\":{...},\"strengths\":[...]}"
  │   └─ created_at: timestamp
  │
  └─ evaluation_responses rows (array):
      ├─ [{criteria_id: UUID, score: 85, ...}, ...]
  │
  ▼
Transformation (in handleGetFeedback):
  ├─ Parse JSON from feedback_reports.content
  ├─ Extract overall_score from parsed.scores.average
  ├─ Extract strengths, weaknesses, recommendations arrays
  ├─ Map evaluation_responses rows to criterion_scores array
  └─ Combine into single response object
  │
  ▼
API Response (200 OK):
  {
    "submission_id": "uuid",
    "overall_score": 85,
    "strengths": ["...", "..."],
    "weaknesses": ["...", "..."],
    "recommendations": ["...", "..."],
    "detailed_feedback": "This document...",
    "criterion_scores": [
      {
        "criterion_id": "uuid",
        "criterion_name": "Market Analysis",
        "score": 85,
        "weight": 0.25
      },
      ...
    ],
    "generated_at": "2026-01-25T22:41:04.058Z",
    "generated_by": "ai-scoring-agent"
  }
```

---

## Error Handling

### Frontend Errors

```
Error Type: Network failure (API Gateway unreachable)
  └─ Handling:
      ├─ Display: "Unable to connect. Check your internet connection."
      ├─ Action: Retry button
      └─ Logging: Console.error()

Error Type: Authentication failure (401 Unauthorized)
  └─ Handling:
      ├─ Display: "Session expired. Please log in again."
      ├─ Action: Redirect to /login
      └─ Clear: localStorage.removeItem('token')

Error Type: File too large (>10MB)
  └─ Handling:
      ├─ Display: "File is too large (12.5MB). Maximum size is 10MB."
      ├─ Action: User must select smaller file
      └─ Validation: Before API call

Error Type: Unsupported file type
  └─ Handling:
      ├─ Display: "Unsupported file type. Please upload PDF, DOCX, DOC, or TXT."
      ├─ Action: User must select different file
      └─ Validation: Before API call
```

### Backend Errors

```
Error Type: Step Functions not triggered (missing env var)
  └─ Handling:
      ├─ Log: "WORKFLOW_STATE_MACHINE_ARN not set"
      ├─ Action: Submission still created (status='submitted', ai_analysis_status='pending')
      ├─ User Impact: Analysis never starts, stuck in 'pending'
      └─ Fix: Add environment variable to submissions Lambda

Error Type: S3 upload failure
  └─ Handling:
      ├─ Log: Error details
      ├─ Response: 500 Internal Server Error
      └─ Rollback: Delete database record (transaction)

Error Type: Database connection timeout
  └─ Handling:
      ├─ Retry: 3 attempts with exponential backoff
      ├─ Response: 503 Service Unavailable
      └─ Logging: CloudWatch error log

Error Type: Claude API rate limit exceeded
  └─ Handling:
      ├─ Step Functions: Retry with exponential backoff (3 attempts)
      ├─ Final failure: Mark submission as 'failed'
      └─ Notification: (Future) Send email to user
```

### AI Workflow Errors

```
Error Type: Text extraction failure (corrupted PDF)
  └─ Handling:
      ├─ Lambda: Catch exception, log details
      ├─ Step Functions: Retry 3 times
      ├─ Final failure: Mark submission as 'failed'
      └─ Database: Update ai_analysis_status = 'failed'

Error Type: Agent timeout (>30s)
  └─ Handling:
      ├─ Step Functions: Wait up to 5 minutes
      ├─ Timeout: Mark execution as timed out
      └─ Retry: 3 attempts total

Error Type: Invalid JSON response from Claude
  └─ Handling:
      ├─ Lambda: Try to parse, log error if failed
      ├─ Fallback: Use default values
      └─ Continue: Don't fail entire workflow
```

---

## Performance Optimizations

### 1. Database Query Optimization

```
Issue: Slow feedback retrieval due to multiple queries
  │
  └─ Solution:
      ├─ Single query with JOIN instead of multiple queries
      ├─ Indexes on foreign keys (submission_id, criteria_id)
      └─ LIMIT 1 on feedback_reports query (only need latest)
  │
  ▼
Before: ~500ms (3 queries)
After: ~50ms (2 queries with JOIN)
```

### 2. Frontend Polling Strategy

```
Issue: Excessive API calls while waiting for analysis
  │
  └─ Solution:
      ├─ Poll every 10 seconds (not every 1 second)
      ├─ Stop polling once ai_analysis_status = 'completed'
      ├─ Use useEffect cleanup to prevent memory leaks
      └─ Exponential backoff if errors occur
  │
  ▼
Before: 150 API calls per 2.5 minute workflow
After: 15 API calls per 2.5 minute workflow (90% reduction)
```

### 3. S3 Upload Optimization

```
Issue: Large files take long to upload
  │
  └─ Solution:
      ├─ Use S3 multipart upload for files >5MB (future)
      ├─ Compress text files before upload (future)
      └─ Use S3 Transfer Acceleration (future)
  │
  ▼
Current: ~2s for 10MB file
Future: ~500ms for 10MB file (estimated)
```

---

## Data Validation

### Frontend Validation

```
File Upload:
  ├─ File size: <= 10MB (10 * 1024 * 1024 bytes)
  ├─ File type: .pdf, .docx, .doc, .txt
  └─ Required fields: session_id, overlay_id

Paste Text:
  ├─ Text length: <= 10MB equivalent (10 * 1024 * 1024 bytes)
  ├─ Text content: Must be non-empty after trim()
  └─ Required fields: session_id, overlay_id
```

### Backend Validation

```
API Request:
  ├─ JWT token: Must be valid and not expired
  ├─ User permissions: User must have access to session
  ├─ Session status: Must be 'active' (not 'archived' or 'closed')
  └─ Overlay status: Must exist and be active

Database Constraints:
  ├─ Foreign keys: submission_id references document_submissions
  ├─ Check constraints: status IN ('submitted', 'approved', 'rejected')
  ├─ NOT NULL: submission_id, document_name, s3_bucket, s3_key
  └─ Unique constraints: (submission_id, criteria_id) in evaluation_responses
```

---

## Data Retention

### Document Storage (S3)
- **Retention**: Indefinite (until manually deleted)
- **Versioning**: Disabled (v1.1), could enable for audit trail
- **Lifecycle**: (Future) Archive to Glacier after 1 year

### Database Records
- **Submissions**: Indefinite retention
- **Feedback Reports**: Indefinite retention
- **CloudWatch Logs**: 30 days (configurable)
- **Step Functions History**: 90 days (AWS default)

---

## Troubleshooting Common Data Flow Issues

### Issue: Submission stuck in 'pending'

**Symptoms**: ai_analysis_status never changes from 'pending'

**Diagnosis**:
1. Check Step Functions executions: Did workflow start?
2. Check CloudWatch logs for submissions Lambda: Was StartExecutionCommand called?
3. Check environment variable: Is WORKFLOW_STATE_MACHINE_ARN set?

**Common Causes**:
- Missing WORKFLOW_STATE_MACHINE_ARN environment variable
- IAM permissions missing for Step Functions
- Step Functions state machine doesn't exist

**Fix**: See STUCK_SUBMISSION_FIX.md

### Issue: Feedback not displaying

**Symptoms**: GET /submissions/{id}/feedback returns 404 or empty data

**Diagnosis**:
1. Check feedback_reports table: Does row exist for submission_id?
2. Check Step Functions: Did workflow complete successfully?
3. Check scoring Lambda logs: Was feedback saved?

**Common Causes**:
- Query targeting wrong table (ai_agent_results instead of feedback_reports)
- SQL column name mismatch (criterion_id vs criteria_id)
- Scoring agent failed to save results

**Fix**: See FEEDBACK_DISPLAY_FIX.md and SQL_COLUMN_FIX.md

### Issue: Text extraction failing

**Symptoms**: Structure validator fails with error "Unable to extract text"

**Diagnosis**:
1. Check S3: Does file exist at s3_key?
2. Check file format: Is content_type correct?
3. Check Lambda layer: Does it include mammoth and pdf-parse?

**Common Causes**:
- Corrupted PDF/DOCX file
- Missing dependencies in Lambda layer
- Unsupported file format

**Fix**: Ensure Lambda layer v14+ includes all text extraction dependencies

---

## References

- **System Overview**: `00_SYSTEM_OVERVIEW.md`
- **Database Schema**: `03_DATABASE_SCHEMA.md`
- **LLM Orchestration**: `05_LLM_ORCHESTRATION.md`
- **Deployment Guide**: `09_DEPLOYMENT.md`
- **Bug Fix Documentation**:
  - `FEEDBACK_DISPLAY_FIX.md`
  - `SQL_COLUMN_FIX.md`
  - `PASTE_TEXT_FEATURE.md`
  - `STUCK_SUBMISSION_FIX.md`

---

**Last Updated**: January 25, 2026
**Document Owner**: Technical Architecture Team
