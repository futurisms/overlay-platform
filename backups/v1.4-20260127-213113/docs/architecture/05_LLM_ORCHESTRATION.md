# LLM Orchestration Documentation

**Overlay Platform - AI Document Analysis Workflow**
**Last Updated**: January 26, 2026
**Version**: v1.1

---

## Table of Contents

1. [Overview](#overview)
2. [Step Functions Workflow](#step-functions-workflow)
3. [Execution Flow](#execution-flow)
4. [AI Agents](#ai-agents)
5. [Trigger Mechanisms](#trigger-mechanisms)
6. [Document Text Extraction](#document-text-extraction)
7. [Prompt Engineering](#prompt-engineering)
8. [Error Handling & Retries](#error-handling--retries)
9. [State Management](#state-management)
10. [Performance & Cost](#performance--cost)
11. [Monitoring & Debugging](#monitoring--debugging)
12. [Configuration](#configuration)

---

## Overview

The Overlay Platform uses **AWS Step Functions** to orchestrate a sophisticated **6-agent AI workflow** that analyzes documents submitted for review. Each agent is a specialized Lambda function that invokes Claude AI for specific analysis tasks.

### Architecture Pattern:

```
User Submit → API Gateway → Lambda Handler → Step Functions → 6 AI Agents → Database
                                                    ↓
                                            Claude Sonnet 4.5
```

### Key Components:
- **Step Functions State Machine**: `overlay-document-analysis`
- **6 AI Agents**: Structure, Content, Grammar, Orchestrator, Clarification, Scoring
- **LLM Provider**: Claude Sonnet 4.5 (Anthropic) via AWS Bedrock + Direct API
- **Trigger**: API POST /submissions or S3 upload event
- **Storage**: Aurora PostgreSQL for results, S3 for documents
- **Workflow Duration**: ~2 minutes per document (6 agents × ~20 seconds each)

---

## Step Functions Workflow

### State Machine Definition:

**Name**: `overlay-document-analysis`
**Timeout**: 15 minutes
**Tracing**: X-Ray enabled
**Logs**: CloudWatch `/aws/stepfunctions/overlay-document-analysis`

### Workflow Diagram:

```
┌─────────────────────────────────────────────────────────────────┐
│                    STEP FUNCTIONS WORKFLOW                      │
└─────────────────────────────────────────────────────────────────┘

Input: {
  documentId: "uuid",
  submissionId: "uuid",
  s3Bucket: "overlay-documents-{account}",
  s3Key: "submissions/{userId}/{timestamp}-{filename}",
  overlayId: "uuid"
}

                    ┌──────────────────────┐
                    │  Structure Validator │ ← Agent 1 (Bedrock Haiku)
                    │                      │
                    │  • Validate structure│
                    │  • Check compliance  │
                    │  • Score: 0-100      │
                    └──────────┬───────────┘
                               │ resultPath: $.structureValidationResult
                               │ outputPath: $ (preserve all state)
                               ↓
                    ┌──────────────────────┐
                    │  Content Analyzer    │ ← Agent 2 (Bedrock Haiku)
                    │                      │
                    │  • Analyze content   │
                    │  • Check completeness│
                    │  • Score: 0-100      │
                    └──────────┬───────────┘
                               │ resultPath: $.contentAnalysisResult
                               │ Receives: structureValidation
                               ↓
                    ┌──────────────────────┐
                    │   Grammar Checker    │ ← Agent 3 (Bedrock Haiku)
                    │                      │
                    │  • Check grammar     │
                    │  • Find spelling err │
                    │  • Score: 0-100      │
                    └──────────┬───────────┘
                               │ resultPath: $.grammarCheckResult
                               │ Receives: structureValidation + contentAnalysis
                               ↓
                    ┌──────────────────────┐
                    │   Orchestrator       │ ← Agent 4 (Claude Sonnet)
                    │                      │
                    │  • Synthesize results│
                    │  • Calculate avg     │
                    │  • Generate summary  │
                    └──────────┬───────────┘
                               │ resultPath: $.orchestrationResult
                               │ Receives: all previous 3 results
                               ↓
                    ┌──────────────────────┐
                    │   Clarification      │ ← Agent 5 (Claude Sonnet)
                    │                      │
                    │  • Generate questions│
                    │  • Identify gaps     │
                    │  • Save to DB        │
                    └──────────┬───────────┘
                               │ resultPath: $.clarificationResult
                               │ Receives: all previous 4 results
                               ↓
                    ┌──────────────────────┐
                    │      Scoring         │ ← Agent 6 (Claude Sonnet)
                    │                      │
                    │  • Final scoring     │
                    │  • Generate feedback │
                    │  • Save to DB ✓      │
                    └──────────┬───────────┘
                               │ resultPath: $.scoringResult
                               │ Receives: ALL 5 previous results
                               ↓
                    ┌──────────────────────┐
                    │  Analysis Complete   │ ← Success State
                    └──────────────────────┘

Output: {
  documentId,
  submissionId,
  finalScore: 84,
  scoring: { ... },
  allResults: { ... }
}
```

### Key Design Decisions:

1. **Sequential Execution**: Agents run sequentially (not parallel) because each depends on previous results
2. **State Preservation**: `outputPath: '$'` preserves entire state, allowing each agent to access all previous results
3. **Result Path Pattern**: Each agent's output saved to `$.{agentName}Result` to avoid overwriting previous results
4. **Fail-Fast**: If any agent fails, workflow fails immediately (no partial results)

---

## Execution Flow

### Step-by-Step Execution:

#### Step 1: Structure Validator (20-30 seconds)

**Purpose**: Validate document structure against template requirements

**Input**:
```json
{
  "documentId": "uuid",
  "submissionId": "uuid",
  "s3Key": "submissions/{userId}/document.docx",
  "s3Bucket": "overlay-documents-...",
  "overlayId": "uuid"
}
```

**Actions**:
1. Connect to Aurora PostgreSQL
2. Load overlay configuration (including context fields v1.1)
3. Fetch document from S3
4. Extract text using mammoth (DOCX) or pdf-parse (PDF)
5. Build prompt with document context
6. Invoke Bedrock Haiku
7. Parse JSON response
8. Create submission record in database (if doesn't exist)

**Output**:
```json
{
  "documentId": "...",
  "submissionId": "uuid-from-db",
  "structureValidation": {
    "isCompliant": true,
    "score": 88,
    "issues": ["Missing executive summary"],
    "feedback": "Document structure is mostly compliant...",
    "agent": "structure-validator",
    "model": "anthropic.claude-haiku-20240307",
    "timestamp": "2026-01-26T12:00:00Z"
  }
}
```

#### Step 2: Content Analyzer (20-30 seconds)

**Purpose**: Analyze content quality and completeness

**Input**: All previous state + `structureValidation`

**Actions**:
1. Connect to Aurora
2. Load overlay configuration
3. Fetch document from S3
4. Build prompt with structure validation results + document context
5. Invoke Bedrock Haiku
6. Parse response

**Output Adds**:
```json
{
  "contentAnalysis": {
    "score": 82,
    "findings": ["Strong introduction", "Weak methodology section"],
    "completeness": 0.85,
    "agent": "content-analyzer",
    ...
  }
}
```

#### Step 3: Grammar Checker (20-30 seconds)

**Purpose**: Check grammar, spelling, and writing quality

**Input**: All previous state + `structureValidation` + `contentAnalysis`

**Actions**:
1. Connect to Aurora
2. Fetch document from S3
3. Build prompt with previous results + document context
4. Invoke Bedrock Haiku
5. Parse response

**Output Adds**:
```json
{
  "grammarCheck": {
    "score": 90,
    "errors": [
      {"type": "spelling", "location": "page 3", "correction": "..."},
      {"type": "grammar", "location": "page 7", "correction": "..."}
    ],
    "agent": "grammar-checker",
    ...
  }
}
```

#### Step 4: Orchestrator (20-30 seconds)

**Purpose**: Synthesize all analysis results and generate summary

**Input**: All previous state (structure + content + grammar)

**Actions**:
1. Connect to Aurora
2. Load evaluation criteria
3. Calculate average score from 3 agents
4. Build comprehensive prompt with all results + document context
5. Invoke Claude Sonnet (not Haiku - needs better synthesis)
6. Generate summary and determine if clarification needed

**Output Adds**:
```json
{
  "orchestration": {
    "averageScore": 87,
    "summary": "Document demonstrates strong structure...",
    "needsClarification": true,
    "clarificationQuestions": [
      {"question": "...", "priority": "high"}
    ],
    "agent": "orchestrator",
    ...
  }
}
```

#### Step 5: Clarification (15-25 seconds)

**Purpose**: Generate targeted questions for unclear sections

**Input**: All previous state (all 4 agents)

**Actions**:
1. Check if clarification needed (orchestrator.needsClarification)
2. If not needed, skip and return
3. Connect to Aurora
4. Load overlay context
5. Build prompt with all analysis results + document context
6. Invoke Claude Sonnet
7. Parse questions from response
8. **Save questions to database** (clarification_questions table)

**Output Adds**:
```json
{
  "clarification": {
    "questionsGenerated": 5,
    "questions": [
      {
        "question_id": "uuid",
        "question_text": "Can you clarify the methodology?",
        "priority": "high",
        "status": "pending"
      }
    ],
    "agent": "clarification",
    ...
  }
}
```

#### Step 6: Scoring (30-40 seconds - longest agent)

**Purpose**: Calculate final scores and generate comprehensive feedback

**Input**: All previous state (ALL 5 agents)

**Actions**:
1. Connect to Aurora
2. Load overlay configuration + evaluation criteria
3. Build comprehensive scoring prompt with:
   - All 5 previous agent results
   - Evaluation criteria with weights
   - Document context fields (v1.1)
4. Invoke Claude Sonnet with 8192 max tokens (largest)
5. Parse JSON response with:
   - Criterion-by-criterion scores
   - Overall feedback
   - Strengths, weaknesses, recommendations
6. **Save to database**:
   - **feedback_reports table** (report_type='comment') ← Final feedback
   - **evaluation_responses table** (criterion scores)
7. Update submission status to 'approved' / 'completed'
8. Calculate weighted final score

**Output Adds**:
```json
{
  "finalScore": 84,
  "scoring": {
    "structureScore": 88,
    "contentScore": 82,
    "grammarScore": 90,
    "finalScore": 84,
    "criteriaScored": 4,
    "reportId": "uuid",
    "feedback": "This document demonstrates...",
    "strengths": ["Clear structure", "Strong evidence"],
    "weaknesses": ["Weak methodology", "Missing citations"],
    "recommendations": ["Add methodology section", "Include references"],
    "agent": "scoring",
    "model": "claude-sonnet-4-5-20250929",
    "timestamp": "2026-01-26T12:02:00Z"
  }
}
```

---

## AI Agents

### Agent Details:

| # | Agent | Model | Timeout | Max Tokens | Purpose | DB Writes |
|---|-------|-------|---------|------------|---------|-----------|
| 1 | **structure-validator** | Bedrock Haiku | 2 min | 2048 | Validate structure | submission record |
| 2 | **content-analyzer** | Bedrock Haiku | 2 min | 2048 | Analyze content | - |
| 3 | **grammar-checker** | Bedrock Haiku | 2 min | 2048 | Check grammar | - |
| 4 | **orchestrator** | Claude Sonnet | 2 min | 4096 | Synthesize results | - |
| 5 | **clarification** | Claude Sonnet | 2 min | 3072 | Generate questions | clarification_questions |
| 6 | **scoring** | Claude Sonnet | 3 min | 8192 | Final scoring + feedback | feedback_reports, evaluation_responses |

### Why Different Models?

**Bedrock Haiku** (Agents 1-3):
- ✅ Faster execution (~15-20s vs 25-30s)
- ✅ Lower cost ($0.25/MTok vs $3/MTok)
- ✅ Sufficient for structured analysis tasks
- ✅ Good for validation, error detection, pattern matching

**Claude Sonnet** (Agents 4-6):
- ✅ Better synthesis and reasoning
- ✅ More nuanced understanding
- ✅ Required for complex tasks (orchestration, scoring, questions)
- ✅ Better at generating comprehensive feedback

### Agent Dependencies:

```
structure-validator (standalone)
        ↓
content-analyzer (needs structure results)
        ↓
grammar-checker (needs structure + content)
        ↓
orchestrator (needs all 3 analysis results)
        ↓
clarification (needs orchestration decision)
        ↓
scoring (needs ALL previous results)
```

### Code Pattern (All Agents):

```javascript
exports.handler = async (event) => {
  const { documentId, submissionId, s3Key, s3Bucket, overlayId } = event;
  let dbClient = null;

  try {
    // 1. Connect to Aurora
    dbClient = await createDbConnection();

    // 2. Load overlay configuration (includes context fields v1.1)
    const overlay = await getOverlayById(dbClient, overlayId);

    // 3. Fetch and extract document text
    const documentText = await getDocumentFromS3(s3Bucket, s3Key);

    // 4. Build context section for prompt (v1.1)
    const contextInfo = [];
    if (overlay.document_purpose) {
      contextInfo.push(`DOCUMENT PURPOSE: ${overlay.document_purpose}`);
    }
    if (overlay.when_used) {
      contextInfo.push(`WHEN USED: ${overlay.when_used}`);
    }
    if (overlay.process_context) {
      contextInfo.push(`PROCESS CONTEXT: ${overlay.process_context}`);
    }
    if (overlay.target_audience) {
      contextInfo.push(`TARGET AUDIENCE: ${overlay.target_audience}`);
    }
    const contextSection = contextInfo.length > 0
      ? `\n\nDOCUMENT CONTEXT:\n${contextInfo.join('\n')}\n`
      : '';

    // 5. Build prompt with context
    const prompt = `You are a ${agentType} agent. ${task}${contextSection}

DOCUMENT CONTENT:
${documentText.substring(0, 8000)}

PREVIOUS ANALYSIS:
${JSON.stringify(previousResults, null, 2)}

Respond in JSON format: {...}`;

    // 6. Invoke LLM
    const claude = await getClaudeClient(); // or Bedrock
    const response = await claude.sendMessage(prompt, {
      model: process.env.MODEL_ID,
      max_tokens: 2048,
    });

    // 7. Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const result = JSON.parse(jsonMatch[0]);

    // 8. Save to database (scoring + clarification only)
    if (shouldSaveToDb) {
      await saveResults(dbClient, result);
    }

    // 9. Return results
    return {
      documentId,
      submissionId,
      ...event, // Preserve all previous state
      [agentName]: {
        ...result,
        agent: agentName,
        model: process.env.MODEL_ID,
        timestamp: new Date().toISOString(),
      },
    };

  } catch (error) {
    console.error('Agent failed:', error);
    throw error;
  } finally {
    if (dbClient) {
      await dbClient.end();
    }
  }
};
```

---

## Trigger Mechanisms

### Method 1: API POST /submissions (Current Method)

**When**: User submits document via frontend

**Flow**:
```
Frontend → API Gateway → overlay-api-submissions Lambda
                                    ↓
                         StartExecutionCommand → Step Functions
```

**Code** (lambda/functions/api/submissions/index.js):
```javascript
const { SFNClient, StartExecutionCommand } = require('@aws-sdk/client-sfn');
const sfn = new SFNClient({ region: process.env.AWS_REGION });

async function handleCreateSubmission(event, userId) {
  // 1. Save document to S3
  const s3Key = `submissions/${userId}/${timestamp}-${filename}`;
  await s3.send(new PutObjectCommand({ Bucket, Key: s3Key, Body }));

  // 2. Create submission record
  const submission = await createSubmission(dbClient, { ... });

  // 3. Start Step Functions execution
  const input = {
    documentId: submission.submission_id,
    submissionId: submission.submission_id,
    s3Bucket: process.env.DOCUMENTS_BUCKET,
    s3Key,
    overlayId: body.overlayId,
  };

  const command = new StartExecutionCommand({
    stateMachineArn: process.env.WORKFLOW_STATE_MACHINE_ARN,
    input: JSON.stringify(input),
    name: `doc-${submission.submission_id}-${Date.now()}`,
  });

  await sfn.send(command);

  return { statusCode: 201, body: JSON.stringify(submission) };
}
```

**Environment Variable**:
- `WORKFLOW_STATE_MACHINE_ARN`: ARN of Step Functions state machine
- Set in: `lib/compute-stack.ts` when creating Lambda

### Method 2: S3 Upload Event (Alternative - Not Currently Used)

**When**: Document uploaded directly to S3 `submissions/` prefix

**Flow**:
```
S3 Upload → EventBridge → overlay-s3-trigger Lambda → Step Functions
```

**Code** (lib/orchestration-stack.ts):
```javascript
const s3TriggerFunction = new lambda.Function(this, 'S3TriggerFunction', {
  handler: 'index.handler',
  code: lambda.Code.fromInline(`
    const { SFNClient, StartExecutionCommand } = require('@aws-sdk/client-sfn');
    const sfn = new SFNClient();

    exports.handler = async (event) => {
      for (const record of event.Records) {
        const bucket = record.s3.bucket.name;
        const key = decodeURIComponent(record.s3.object.key);

        // Only process submissions/ folder
        if (!key.startsWith('submissions/')) continue;

        const parts = key.split('/');
        const documentId = parts[1];

        const input = {
          documentId,
          submissionId: documentId,
          s3Bucket: bucket,
          s3Key: key,
          overlayId: process.env.DEFAULT_OVERLAY_ID,
        };

        await sfn.send(new StartExecutionCommand({
          stateMachineArn: process.env.STATE_MACHINE_ARN,
          input: JSON.stringify(input),
          name: \`doc-\${documentId}-\${Date.now()}\`,
        }));
      }
    };
  `),
  environment: {
    STATE_MACHINE_ARN: this.documentAnalysisStateMachine.stateMachineArn,
  },
});
```

**Note**: S3 notification not configured due to circular dependency. Can be added manually after deployment.

---

## Document Text Extraction

### Supported Formats:
- ✅ **DOCX**: Microsoft Word documents
- ✅ **PDF**: Portable Document Format
- ✅ **TXT**: Plain text files
- ✅ **DOC**: Legacy Word format (treated as binary)

### Extraction Implementation:

**Location**: `lambda/layers/common/nodejs/db-utils.js`

```javascript
async function getDocumentFromS3(s3Bucket, s3Key) {
  const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
  const s3Client = new S3Client({ region: process.env.AWS_REGION });

  // 1. Fetch document from S3
  const response = await s3Client.send(new GetObjectCommand({
    Bucket: s3Bucket,
    Key: s3Key,
  }));

  // 2. Convert stream to buffer
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);

  // 3. Detect file type from extension
  const fileExtension = s3Key.split('.').pop().toLowerCase();

  try {
    if (fileExtension === 'docx') {
      // Extract text from DOCX using mammoth
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      console.log(`Extracted ${result.value.length} characters from .docx`);
      return result.value;

    } else if (fileExtension === 'pdf') {
      // Extract text from PDF using pdf-parse
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      console.log(`Extracted ${data.text.length} characters from PDF`);
      return data.text;

    } else {
      // Plain text file (txt, doc, etc.)
      return buffer.toString('utf-8');
    }
  } catch (error) {
    console.error('Text extraction failed:', error);
    throw new Error(`Failed to extract text from ${fileExtension} file`);
  }
}
```

### Library Details:

#### mammoth (DOCX)
**Version**: 1.6.0
**Purpose**: Extracts plain text from .docx files
**Method**: `mammoth.extractRawText({ buffer })`
**Output**: Plain text string without formatting
**Pros**:
- ✅ Preserves text structure (paragraphs, lists)
- ✅ Fast extraction (~1-2 seconds)
- ✅ Handles tables and sections
**Cons**:
- ❌ Loses formatting (bold, italic, colors)
- ❌ No image text extraction

#### pdf-parse (PDF)
**Version**: 1.1.1
**Purpose**: Extracts text from PDF files
**Method**: `pdfParse(buffer)`
**Output**: `{ text, numpages, info, metadata }`
**Pros**:
- ✅ Extracts text from all pages
- ✅ Provides page count and metadata
- ✅ Handles multi-column layouts
**Cons**:
- ❌ Struggles with scanned PDFs (no OCR)
- ❌ May misorder text in complex layouts
- ❌ No image extraction

### Pasted Text (v1.1)

**Format**: Base64-encoded text in request body
**Storage**: S3 with key `submissions/{userId}/{timestamp}-pasted-text.txt`
**Content-Type**: `text/plain`
**Extraction**: Direct UTF-8 decoding (no library needed)

**Flow**:
```javascript
// Frontend encodes text
const base64Text = btoa(unescape(encodeURIComponent(pastedText)));

// Backend decodes and stores
const decodedText = Buffer.from(base64Text, 'base64').toString('utf-8');
await s3.send(new PutObjectCommand({
  Bucket,
  Key: s3Key,
  Body: decodedText,
  ContentType: 'text/plain',
}));
```

### Text Limitations:

| File Type | Max Size | Extraction Time | Character Limit (prompt) |
|-----------|----------|-----------------|--------------------------|
| DOCX | 10MB | 1-3 seconds | First 8,000 chars used |
| PDF | 10MB | 2-5 seconds | First 8,000 chars used |
| TXT | 10MB | <1 second | First 8,000 chars used |
| Pasted | 10MB | <1 second | First 8,000 chars used |

**Why 8,000 character limit?**
- Claude Sonnet 4.5 context window: 200k tokens (~750k characters)
- Leaving room for: prompt template + evaluation criteria + previous results + response
- Most documents fit within 8,000 characters
- Future: Implement chunking for longer documents

---

## Prompt Engineering

### Prompt Structure (All Agents):

```
┌────────────────────────────────────────────────────┐
│               AGENT PROMPT TEMPLATE                │
└────────────────────────────────────────────────────┘

[AGENT ROLE]
You are a {agentType} agent. {taskDescription}

[DOCUMENT CONTEXT] ← v1.1 addition
DOCUMENT PURPOSE: {overlay.document_purpose}
WHEN USED: {overlay.when_used}
PROCESS CONTEXT: {overlay.process_context}
TARGET AUDIENCE: {overlay.target_audience}

[EVALUATION CRITERIA] ← Only in scoring agent
- Criterion 1: {name} ({category}) - {description} [Max: {max_score}, Weight: {weight}]
- Criterion 2: ...

[PREVIOUS ANALYSIS] ← Only in agents 2-6
Structure Validation: {JSON}
Content Analysis: {JSON}
Grammar Check: {JSON}
...

[DOCUMENT CONTENT]
{documentText.substring(0, 8000)}

[OUTPUT FORMAT]
Respond in JSON format:
{
  "field1": "...",
  "field2": [...],
  ...
}
```

### Context Fields Impact (v1.1):

**Before v1.1** (No Context):
```
Prompt: "You are a content analyzer. Analyze this document."

Result: Generic analysis, may miss domain-specific requirements
```

**After v1.1** (With Context):
```
Prompt: "You are a content analyzer.

DOCUMENT CONTEXT:
DOCUMENT PURPOSE: Legal agreement establishing terms between parties
WHEN USED: Pre-signature review and compliance verification
PROCESS CONTEXT: Legal review and approval workflow
TARGET AUDIENCE: Legal team, executives, compliance officers

Analyze this document."

Result: Context-aware analysis, identifies legal-specific issues,
        considers compliance requirements, targets legal audience
```

### Example Prompts:

#### Structure Validator:
```
You are a document structure validator. Analyze if the following document matches the required structure template.

REQUIRED STRUCTURE TEMPLATE:
{
  "sections": ["Executive Summary", "Methodology", "Results", "Conclusion"],
  "minLength": 1000,
  "maxLength": 10000
}

DOCUMENT TYPE: research_paper

DOCUMENT CONTEXT:
DOCUMENT PURPOSE: Research paper to present findings and secure publication
WHEN USED: Pre-submission academic review
PROCESS CONTEXT: Academic peer review workflow
TARGET AUDIENCE: Researchers, journal editors, academic community

DOCUMENT CONTENT:
[8000 characters of document text]

Please analyze the document and respond in JSON format:
{
  "isCompliant": true or false,
  "score": number from 0-100,
  "issues": [array of specific structural issues found],
  "feedback": "brief summary of compliance status"
}
```

#### Scoring Agent:
```
You are a document scoring agent. Score each evaluation criterion based on the analysis results and generate comprehensive feedback.

DOCUMENT CONTEXT:
DOCUMENT PURPOSE: Biomedical Catalyst application to secure funding
WHEN USED: Initial submission screening before detailed review
PROCESS CONTEXT: Competitive evaluation and selection process
TARGET AUDIENCE: Evaluation committee, decision-makers

EVALUATION CRITERIA:
- Question 9 Overview (ai_analysis): Evaluate Question 9 response quality [Max: 100, Weight: 1.0, Method: ai_analysis]

ANALYSIS RESULTS:

Structure Validation (88/100):
{
  "isCompliant": true,
  "score": 88,
  "issues": ["Missing executive summary"],
  "feedback": "Document structure is mostly compliant..."
}

Content Analysis (82/100):
{
  "score": 82,
  "findings": ["Strong introduction", "Weak methodology"],
  "completeness": 0.85
}

Grammar Check (90/100):
{
  "score": 90,
  "errors": [{"type": "spelling", "location": "page 3"}]
}

Orchestration Summary:
Average score: 87. Document demonstrates strong structure and grammar but needs methodology improvement.

Respond in JSON format:
{
  "criterionScores": [
    {
      "criterionId": "criterion_id from above list",
      "criterionName": "criterion name",
      "score": number from 0 to max_score,
      "reasoning": "detailed reasoning for this score"
    }
  ],
  "overallFeedback": {
    "title": "brief title for the feedback report",
    "content": "comprehensive feedback covering strengths, weaknesses, and recommendations",
    "severity": "low|medium|high|critical",
    "strengths": ["strength 1", "strength 2"],
    "weaknesses": ["weakness 1", "weakness 2"],
    "recommendations": ["recommendation 1", "recommendation 2"]
  }
}
```

---

## Error Handling & Retries

### Step Functions Retry Configuration:

```typescript
// In lib/orchestration-stack.ts
const structureValidation = new tasks.LambdaInvoke(this, 'StructureValidation', {
  lambdaFunction: props.structureValidatorFunction,
  retryOnServiceExceptions: true, // Auto-retry on AWS service errors
  // Additional retry config (implicit defaults):
  // - IntervalSeconds: 2
  // - MaxAttempts: 3
  // - BackoffRate: 2.0 (exponential: 2s, 4s, 8s)
});
```

### Retry Strategy:

| Error Type | Retries | Backoff | Total Time | Action |
|------------|---------|---------|------------|--------|
| **Service Exception** (AWS) | 3 | Exponential (2s, 4s, 8s) | 14s | Auto-retry, then fail |
| **Lambda Timeout** | 0 | N/A | 0s | Immediate fail |
| **Lambda Error** (code) | 0 | N/A | 0s | Immediate fail |
| **Throttling** | 3 | Exponential | 14s | Auto-retry |

### Error Flow:

```
Agent Error → Step Functions Catch → Failure State → EventBridge
                                                            ↓
                                               Failed Execution Rule
                                                            ↓
                                                  SQS Dead Letter Queue
                                                            ↓
                                            (Manual Review/Retry)
```

### Dead Letter Queue (DLQ):

**Queue**: `overlay-processing-dlq`
**Retention**: 14 days
**Encryption**: KMS-managed
**Purpose**: Store failed executions for manual review

**Accessing Failed Executions**:
```bash
# List messages in DLQ
aws sqs receive-message \
  --queue-url https://sqs.{region}.amazonaws.com/{account}/overlay-processing-dlq \
  --max-number-of-messages 10

# Get execution details
aws stepfunctions describe-execution \
  --execution-arn {executionArn}

# View execution history
aws stepfunctions get-execution-history \
  --execution-arn {executionArn} \
  --max-results 100
```

### Lambda Error Handling:

```javascript
exports.handler = async (event) => {
  let dbClient = null;

  try {
    dbClient = await createDbConnection();
    // ... agent logic ...
    return { success: true, ... };

  } catch (error) {
    console.error('Agent failed:', error);
    console.error('Stack trace:', error.stack);

    // Try to update submission status to failed
    if (dbClient && submissionId) {
      try {
        await updateSubmissionStatus(dbClient, submissionId, 'rejected', 'failed');
      } catch (updateError) {
        console.error('Failed to update submission status:', updateError);
      }
    }

    // Re-throw to trigger Step Functions failure
    throw error;

  } finally {
    // Always close database connection
    if (dbClient) {
      try {
        await dbClient.end();
      } catch (closeError) {
        console.error('Error closing database:', closeError);
      }
    }
  }
};
```

### Common Errors & Solutions:

| Error | Cause | Solution |
|-------|-------|----------|
| `LambdaTimeout` | Agent exceeds 2-3 min timeout | Increase timeout or optimize code |
| `SubmissionNotFound` | Invalid submissionId | Validate UUID format before invoking |
| `OverlayNotFound` | Invalid overlayId | Check overlay exists and is_active |
| `S3NoSuchKey` | Document deleted | Add S3 object existence check |
| `DatabaseConnectionFailed` | Aurora unavailable | Check security groups, VPC config |
| `ClaudeAPIError` | Rate limit or service error | Implement exponential backoff |
| `JSONParseError` | Malformed LLM response | Add fallback parsing logic |

---

## State Management

### State Preservation Pattern:

**Problem**: Each Step Functions task can overwrite the entire state

**Solution**: Use `resultPath` to append results without overwriting

```typescript
const structureValidation = new tasks.LambdaInvoke(this, 'StructureValidation', {
  lambdaFunction: props.structureValidatorFunction,
  resultPath: '$.structureValidationResult', // Append to state, don't overwrite
  outputPath: '$', // Pass entire state to next task
});
```

**State Evolution**:

```json
// Initial Input:
{
  "documentId": "...",
  "submissionId": "...",
  "s3Key": "...",
  "s3Bucket": "...",
  "overlayId": "..."
}

// After Agent 1 (Structure Validator):
{
  "documentId": "...",
  "submissionId": "...",
  "s3Key": "...",
  "s3Bucket": "...",
  "overlayId": "...",
  "structureValidationResult": {
    "Payload": {
      "structureValidation": { "score": 88, ... },
      "submissionId": "..."
    }
  }
}

// After Agent 2 (Content Analyzer):
{
  ...all previous fields...,
  "structureValidationResult": { ... },
  "contentAnalysisResult": {
    "Payload": {
      "contentAnalysis": { "score": 82, ... }
    }
  }
}

// After All 6 Agents:
{
  ...all previous fields...,
  "structureValidationResult": { ... },
  "contentAnalysisResult": { ... },
  "grammarCheckResult": { ... },
  "orchestrationResult": { ... },
  "clarificationResult": { ... },
  "scoringResult": {
    "Payload": {
      "finalScore": 84,
      "scoring": { ... },
      "allResults": { ...all 5 previous agent results... }
    }
  }
}
```

### Accessing Previous Results in Agents:

**Step Functions Payload Mapping**:
```typescript
const contentAnalysis = new tasks.LambdaInvoke(this, 'ContentAnalysis', {
  payload: stepfunctions.TaskInput.fromObject({
    documentId: stepfunctions.JsonPath.stringAt('$.documentId'),
    submissionId: stepfunctions.JsonPath.stringAt('$.structureValidationResult.Payload.submissionId'),
    s3Key: stepfunctions.JsonPath.stringAt('$.s3Key'),
    s3Bucket: stepfunctions.JsonPath.stringAt('$.s3Bucket'),
    overlayId: stepfunctions.JsonPath.stringAt('$.overlayId'),
    structureValidation: stepfunctions.JsonPath.objectAt('$.structureValidationResult.Payload.structureValidation'),
  }),
});
```

**Lambda Handler**:
```javascript
exports.handler = async (event) => {
  // Event contains only the fields mapped in Step Functions payload
  const {
    documentId,
    submissionId,
    s3Key,
    s3Bucket,
    overlayId,
    structureValidation, // From previous agent
    contentAnalysis,      // From 2 agents ago
    grammarCheck,         // From 3 agents ago
  } = event;

  // Use previous results in prompt
  const prompt = `
PREVIOUS ANALYSIS:
Structure: ${structureValidation.score}/100
Content: ${contentAnalysis.score}/100
Grammar: ${grammarCheck.score}/100
  `;
};
```

---

## Performance & Cost

### Performance Characteristics:

| Metric | Value | Notes |
|--------|-------|-------|
| **Total Duration** | ~2 minutes | 6 agents × ~20s each |
| **Agent 1-3 Duration** | 15-25s each | Bedrock Haiku (faster) |
| **Agent 4-5 Duration** | 20-30s each | Claude Sonnet |
| **Agent 6 Duration** | 30-40s | Claude Sonnet (largest response) |
| **Database Queries** | 15-20 per workflow | 2-3 per agent |
| **S3 Fetches** | 6 | One per agent (could be optimized) |
| **Text Extraction** | 1-5s per agent | DOCX: 1-3s, PDF: 2-5s |

### Bottlenecks:

1. **S3 Fetch Duplication**: Each agent fetches document independently
   - **Impact**: 5-30 seconds wasted across 6 agents
   - **Solution**: Cache document text in Step Functions state (future)

2. **Sequential Execution**: Agents must run sequentially
   - **Impact**: ~2 minutes total (vs ~30s if parallel)
   - **Reason**: Each agent depends on previous results
   - **Solution**: None (by design)

3. **LLM Invocation Time**: Claude API latency
   - **Impact**: 15-30s per agent
   - **Solution**: Use faster models (Haiku) for simple tasks ✅ (implemented)

4. **Database Connection**: Cold start + connection time
   - **Impact**: 1-3s per agent
   - **Solution**: Connection pooling (future)

### Cost Analysis (per document):

#### LLM Costs:

| Agent | Model | Input Tokens | Output Tokens | Cost per Run |
|-------|-------|--------------|---------------|--------------|
| Structure | Bedrock Haiku | ~3,000 | ~500 | $0.0010 |
| Content | Bedrock Haiku | ~3,500 | ~600 | $0.0011 |
| Grammar | Bedrock Haiku | ~3,500 | ~700 | $0.0012 |
| Orchestrator | Claude Sonnet | ~5,000 | ~1,000 | $0.021 |
| Clarification | Claude Sonnet | ~4,000 | ~800 | $0.017 |
| Scoring | Claude Sonnet | ~6,000 | ~2,000 | $0.030 |
| **Total LLM Cost** | | **~25k tokens** | **~5.6k tokens** | **$0.071** |

**Pricing (January 2026)**:
- Bedrock Haiku: $0.25 per MTok input, $1.25 per MTok output
- Claude Sonnet 4.5: $3 per MTok input, $15 per MTok output

#### AWS Service Costs:

| Service | Usage | Cost per Run |
|---------|-------|--------------|
| Step Functions | 1 execution, ~6 state transitions | $0.000025 |
| Lambda (6 invocations) | 6 × 2 min × 1024MB | $0.0020 |
| S3 (GET) | 6 GET requests, ~1MB each | $0.000002 |
| Aurora Serverless | ~20 queries, ~10 ACU-seconds | $0.0013 |
| CloudWatch Logs | ~500KB logs | $0.000005 |
| **Total AWS Cost** | | **$0.0033** |

#### Total Cost per Document:

```
LLM Cost:     $0.071
AWS Cost:     $0.003
────────────────────
Total:        $0.074 (~7.4 cents)
```

**Monthly Cost Estimates**:
- 100 documents/month: **$7.40**
- 1,000 documents/month: **$74**
- 10,000 documents/month: **$740**

### Cost Optimization Strategies:

1. **Use Haiku for Simple Tasks** ✅ (implemented)
   - Agents 1-3 use Haiku (10x cheaper than Sonnet)
   - Savings: ~$0.06 per document

2. **Cache Document Text** (future)
   - Pass document text in Step Functions state
   - Eliminate 5/6 S3 fetches
   - Savings: ~$0.00001 per document (negligible)

3. **Batch Processing** (future)
   - Process multiple documents in single workflow
   - Amortize Step Functions costs
   - Savings: ~$0.0002 per document

4. **Prompt Optimization** (ongoing)
   - Reduce token usage with concise prompts
   - Use shorter document excerpts when possible
   - Savings: ~$0.01-0.02 per document

5. **Aurora Serverless Scaling** (configured)
   - Min: 0.5 ACU, Max: 2 ACU
   - Auto-pause after 5 minutes
   - Savings: ~$0.001 per document during off-peak

---

## Monitoring & Debugging

### CloudWatch Dashboards:

**Step Functions Metrics**:
- `ExecutionsStarted`: Number of workflows started
- `ExecutionsFailed`: Number of failed workflows
- `ExecutionTime`: Duration in milliseconds
- `ExecutionThrottled`: Number throttled by AWS limits

**Lambda Metrics (per agent)**:
- `Invocations`: Number of invocations
- `Errors`: Number of errors
- `Duration`: Execution time in ms
- `Throttles`: Number throttled by concurrency limits
- `ConcurrentExecutions`: Current concurrent executions

### CloudWatch Logs:

**Step Functions Logs**:
```
Log Group: /aws/stepfunctions/overlay-document-analysis
Retention: 30 days
Format: JSON
```

**Example Log Entry**:
```json
{
  "id": "1",
  "type": "ExecutionStarted",
  "details": {
    "input": "{\"documentId\":\"...\",\"submissionId\":\"...\"}",
    "roleArn": "arn:aws:iam::..."
  },
  "event_timestamp": 1706283600000
}
```

**Lambda Logs** (each agent):
```
Log Group: /aws/lambda/overlay-{agent-name}
Retention: 30 days
Format: Text
```

**Example Log Entry**:
```
2026-01-26T12:00:00.123Z  INFO  Structure Validator started: {...}
2026-01-26T12:00:00.456Z  INFO  Connecting to Aurora...
2026-01-26T12:00:01.234Z  INFO  Connected to Aurora successfully
2026-01-26T12:00:01.567Z  INFO  Loading overlay: 20000000-...
2026-01-26T12:00:02.890Z  INFO  Overlay loaded: Contract Review
2026-01-26T12:00:03.123Z  INFO  Fetching document from S3: overlay-documents-.../submissions/...
2026-01-26T12:00:04.567Z  INFO  Extracted 5234 characters from .docx file
2026-01-26T12:00:05.890Z  INFO  Invoking Bedrock for structure validation...
2026-01-26T12:00:20.123Z  INFO  Bedrock response received
2026-01-26T12:00:20.456Z  INFO  Structure validation complete: COMPLIANT
```

### X-Ray Tracing:

**Enabled**: Yes (Step Functions tracing enabled)

**Trace View**:
```
Step Functions Execution
  │
  ├─ Structure Validator Lambda (22s)
  │  ├─ Aurora Query (0.5s)
  │  ├─ S3 GetObject (0.8s)
  │  └─ Bedrock InvokeModel (19s)
  │
  ├─ Content Analyzer Lambda (20s)
  │  ├─ Aurora Query (0.4s)
  │  ├─ S3 GetObject (0.7s)
  │  └─ Bedrock InvokeModel (17s)
  │
  └─ ... (4 more agents)
```

### Debugging Failed Executions:

**Step 1: Find Failed Execution**
```bash
aws stepfunctions list-executions \
  --state-machine-arn arn:aws:states:region:account:stateMachine:overlay-document-analysis \
  --status-filter FAILED \
  --max-results 10
```

**Step 2: Get Execution Details**
```bash
aws stepfunctions describe-execution \
  --execution-arn {executionArn}
```

**Step 3: View Execution History**
```bash
aws stepfunctions get-execution-history \
  --execution-arn {executionArn} \
  --max-results 100 \
  --reverse-order
```

**Step 4: Check Lambda Logs**
```bash
# Find which agent failed (from execution history)
# Then check its logs
aws logs tail /aws/lambda/overlay-structure-validator \
  --since 1h \
  --follow
```

**Step 5: Check Database**
```sql
-- Check submission status
SELECT submission_id, status, ai_analysis_status, ai_analysis_completed_at
FROM document_submissions
WHERE submission_id = '{submissionId}';

-- Check if any results were saved
SELECT agent_name, status, error_message
FROM ai_agent_results
WHERE submission_id = '{submissionId}'
ORDER BY created_at;
```

### Common Debug Queries:

**Find Slow Executions**:
```sql
SELECT
  name,
  startDate,
  stopDate,
  EXTRACT(EPOCH FROM (stopDate - startDate)) as duration_seconds
FROM stepfunctions_executions
WHERE stateMachineArn = 'arn:aws:states:...:overlay-document-analysis'
  AND status = 'SUCCEEDED'
  AND EXTRACT(EPOCH FROM (stopDate - startDate)) > 180
ORDER BY duration_seconds DESC
LIMIT 10;
```

**Find Failed Agents**:
```sql
SELECT
  agent_name,
  COUNT(*) as failure_count,
  MAX(created_at) as last_failure
FROM ai_agent_results
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY agent_name
ORDER BY failure_count DESC;
```

---

## Configuration

### Environment Variables (All Agents):

| Variable | Value | Purpose |
|----------|-------|---------|
| `AWS_REGION` | eu-west-1 | AWS region |
| `AURORA_SECRET_ARN` | arn:aws:secretsmanager:... | Database credentials |
| `CLAUDE_API_KEY_SECRET` | arn:aws:secretsmanager:... | Claude API key |
| `LLM_CONFIG_TABLE` | overlay-llm-config | DynamoDB config table |
| `MODEL_ID` | claude-sonnet-4-5-20250929 or anthropic.claude-haiku-20240307 | LLM model |
| `DOCUMENTS_BUCKET` | overlay-documents-{account} | S3 bucket for documents |

### Environment Variables (API Handler):

| Variable | Value | Purpose |
|----------|-------|---------|
| `WORKFLOW_STATE_MACHINE_ARN` | arn:aws:states:...:stateMachine:overlay-document-analysis | Step Functions ARN |

### Model Configuration:

**Bedrock Haiku** (Agents 1-3):
```javascript
{
  modelId: 'anthropic.claude-haiku-20240307',
  anthropic_version: 'bedrock-2023-05-31',
  max_tokens: 2048,
  temperature: 0.7, // Implicit default
}
```

**Claude Sonnet** (Agents 4-6):
```javascript
{
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 3072-8192, // Varies by agent
  // temperature not specified (uses default)
}
```

### IAM Permissions Required:

**Lambda Execution Role**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": [
        "arn:aws:secretsmanager:*:*:secret:overlay-db-secret-*",
        "arn:aws:secretsmanager:*:*:secret:claude-api-key-*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::overlay-documents-*/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel"
      ],
      "Resource": "arn:aws:bedrock:*::foundation-model/anthropic.claude-*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/overlay-llm-config"
    }
  ]
}
```

**API Lambda Role** (additional):
```json
{
  "Effect": "Allow",
  "Action": [
    "states:StartExecution"
  ],
  "Resource": "arn:aws:states:*:*:stateMachine:overlay-document-analysis"
}
```

---

## Known Integration Issues

### Issue 1: Step Functions Manual Trigger (Ongoing ⚠️)

**Problem**: S3 document upload event does not automatically trigger the Step Functions workflow.

**Current Behavior**:
1. User uploads document → Stored in S3
2. Submission record created in database
3. **Workflow does NOT start automatically**
4. Admin must manually trigger via AWS Console

**Root Cause**: S3 event notification not connected to Step Functions state machine.

**Workaround**:
1. Get submission details from database or API:
   ```bash
   curl -X GET https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production/submissions/{id} \
     -H "Authorization: Bearer $TOKEN"
   ```

2. Navigate to AWS Console → Step Functions → `OverlayOrchestrator`

3. Click "Start execution" with payload:
   ```json
   {
     "submissionId": "UUID_FROM_SUBMISSION",
     "documentId": "UUID_FROM_SUBMISSION",
     "s3Key": "documents/FILENAME.pdf",
     "s3Bucket": "overlay-documents-XXXXX",
     "overlayId": "OVERLAY_UUID"
   }
   ```

**Permanent Fix** (TODO):
```typescript
// In lib/orchestration-stack.ts
import { EventBus, Rule } from 'aws-cdk-lib/aws-events';
import { SfnStateMachine } from 'aws-cdk-lib/aws-events-targets';

// Add S3 event notification
documentsBucket.addEventNotification(
  s3.EventType.OBJECT_CREATED,
  new s3n.EventBridgeDestination(eventBus),
  { prefix: 'documents/' }
);

// Add EventBridge rule
new Rule(this, 'DocumentUploadRule', {
  eventBus: eventBus,
  eventPattern: {
    source: ['aws.s3'],
    detailType: ['Object Created'],
    detail: {
      bucket: { name: [documentsBucket.bucketName] },
      object: { key: [{ prefix: 'documents/' }] }
    }
  },
  targets: [new SfnStateMachine(stateMachine)]
});
```

**Verification**:
```bash
# Check if EventBridge rule exists
aws events list-rules --event-bus-name default | grep DocumentUpload

# If empty, rule not configured
```

---

### Issue 2: Feedback Schema Mismatch (Resolved ✅)

**Problem**: GET /submissions/{id}/feedback returned no data even after AI workflow completed.

**Root Cause**: API endpoints queried `feedback_reports` table (for user comments) instead of `ai_agent_results` table (for AI-generated feedback).

**Affected Endpoints**:
- GET /submissions/{id}/feedback
- GET /submissions/{id}/download
- GET /sessions/{id}/report
- GET /sessions/{id}/export

**Fix Applied** (Jan 25, 2026):
```javascript
// Before (WRONG)
const result = await dbClient.query(`
  SELECT * FROM feedback_reports WHERE submission_id = $1
`, [submissionId]);

// After (CORRECT)
const result = await dbClient.query(`
  SELECT agent_name, result_data
  FROM ai_agent_results
  WHERE submission_id = $1
`, [submissionId]);

// Parse JSONB content
const feedback = JSON.parse(result.rows[0].result_data.content);
```

**Verification**:
```bash
# Check if feedback displays
curl -X GET https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production/submissions/{id}/feedback \
  -H "Authorization: Bearer $TOKEN"

# Expected: { detailed_feedback, strengths, weaknesses, recommendations }
# Not: { error: "No feedback found" }
```

---

### Issue 3: Criteria Save Failure (Resolved ✅)

**Problem**: Adding evaluation criteria to overlays showed "Criterion added successfully" but criterion did not persist to database.

**Root Cause**: Backend `handleUpdate` function in overlays handler ignored the `criteria` field in PUT requests.

**Frontend Behavior**:
```typescript
// Frontend sends
PUT /overlays/{id}
{
  criteria: [
    { name: "Test", description: "...", weight: 0.25, max_score: 100, category: "test" }
  ]
}

// Backend ignored this field, only processed: name, description, document_type, configuration, is_active
```

**Fix Applied** (Jan 26, 2026):
```javascript
async function handleUpdate(dbClient, pathParameters, requestBody, userId) {
  const { criteria, ...metadata } = JSON.parse(requestBody);

  // Update overlay metadata
  await dbClient.query(`UPDATE overlays SET ...`, [...]);

  // NEW: Handle criteria updates
  if (criteria !== undefined) {
    // Delete existing criteria
    await dbClient.query('DELETE FROM evaluation_criteria WHERE overlay_id = $1', [overlayId]);

    // Insert new criteria with field mapping
    for (const c of criteria) {
      const criterionType = c.criterion_type || c.category || 'text';
      const weightValue = c.max_score || (c.weight * 100);

      await dbClient.query(`
        INSERT INTO evaluation_criteria
        (overlay_id, name, description, criterion_type, weight, is_required, display_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [overlayId, c.name, c.description, criterionType, weightValue, c.is_required, i]);
    }
  }
}
```

**Schema Mapping**:
| Frontend Field | Database Column | Conversion |
|---------------|----------------|------------|
| `criterion_id` | `criteria_id` | Direct map |
| `category` | `criterion_type` | Direct map |
| `weight` (0-1) | `weight` (0-100) | Multiply by 100 |
| `max_score` | `weight` | Use max_score as weight |

**Verification**:
```bash
node scripts/test-criteria-fix.js

# Expected output:
# ✅ Criterion was saved to database!
# ✅ Criteria count after update: N+1
```

**Test in UI**:
1. Navigate to /overlays
2. Click on any overlay
3. Add criterion with weight 0.25, max_score 100
4. Click "Add Criterion"
5. **PASS**: Criterion appears in list below
6. Refresh page (F5)
7. **PASS**: Criterion still there (persisted)

---

### Issue 4: UUID Validation Errors (Resolved ✅)

**Problem**: AI agents failed with "invalid input syntax for type uuid" when submissionId was numeric.

**Root Cause**: Frontend sent numeric IDs, database expected UUID strings.

**Fix Applied** (Jan 25, 2026):
- Structure validator now generates UUID for submission
- UUID passed through entire workflow chain
- Database schema enforces UUID type on all ID columns

**Verification**:
```bash
# Check submission IDs are UUIDs
aws lambda invoke \
  --function-name overlay-structure-validator \
  --payload '{"documentId":"test","s3Key":"test.txt","s3Bucket":"test","overlayId":"test-uuid"}' \
  response.json

cat response.json | jq '.submissionId'
# Expected: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" (UUID format)
```

---

## Verification Commands

### Check AI Agent Workflow Status
```bash
# List recent Step Functions executions
aws stepfunctions list-executions \
  --state-machine-arn arn:aws:states:eu-west-1:975050116849:stateMachine:OverlayOrchestrator \
  --max-results 10

# Get execution details
aws stepfunctions describe-execution \
  --execution-arn arn:aws:states:eu-west-1:975050116849:execution:OverlayOrchestrator:xxxxx
```

### Check AI Agent Results in Database
```bash
# Via API
curl -X GET https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production/submissions/{id}/feedback \
  -H "Authorization: Bearer $TOKEN"

# Via script
node scripts/check-ai-results.js
```

### Check CloudWatch Logs for Errors
```bash
# Check recent errors across all agents
aws logs filter-log-events \
  --log-group-name /aws/lambda/overlay-structure-validator \
  --start-time $(($(date +%s) - 3600))000 \
  --filter-pattern "ERROR"

# Check specific agent logs
aws logs tail /aws/lambda/overlay-scoring --follow
```

### Check Overlay Criteria
```bash
# Via API
curl -X GET https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production/overlays/{id} \
  -H "Authorization: Bearer $TOKEN" | jq '.criteria'

# Via script
node scripts/check-overlays.js
```

---

## Summary

### Key Takeaways:

1. **6-Agent Sequential Workflow**: Structure → Content → Grammar → Orchestrator → Clarification → Scoring
2. **~2 Minute Duration**: Optimized with Haiku for first 3 agents, Sonnet for complex tasks
3. **Context-Aware Analysis** (v1.1): Document purpose, usage, process, audience inform AI prompts
4. **Text Extraction**: mammoth (DOCX), pdf-parse (PDF), UTF-8 (TXT/pasted)
5. **State Preservation**: `resultPath` + `outputPath: '$'` maintains full workflow state
6. **Error Handling**: Auto-retry (3x exponential backoff) → DLQ for failed executions
7. **Cost**: ~$0.074 per document (95% LLM, 5% AWS services)
8. **Scoring Agent Saves**: feedback_reports (report_type='comment') + evaluation_responses
9. **Trigger**: API POST /submissions → StartExecutionCommand → Step Functions
10. **Monitoring**: CloudWatch Logs + X-Ray + Step Functions console

### Critical Files:

- [`lib/orchestration-stack.ts`](lib/orchestration-stack.ts): Step Functions definition
- [`lambda/layers/common/nodejs/llm-client.js`](lambda/layers/common/nodejs/llm-client.js): LLM client abstraction
- [`lambda/layers/common/nodejs/db-utils.js`](lambda/layers/common/nodejs/db-utils.js): Database + S3 utilities
- [`lambda/functions/scoring/index.js`](lambda/functions/scoring/index.js): Final scoring + feedback generation
- [`lambda/functions/structure-validator/index.js`](lambda/functions/structure-validator/index.js): First agent pattern

### Future Enhancements:

- [ ] Cache document text in Step Functions state (reduce S3 fetches)
- [ ] Implement chunking for documents >8,000 characters
- [ ] Add OCR for scanned PDFs
- [ ] Parallel execution for independent agents (structure + content + grammar)
- [ ] Real-time WebSocket updates for frontend (workflow progress)
- [ ] Batch processing for multiple documents
- [ ] Connection pooling for Aurora
- [ ] Prompt optimization to reduce token usage

---

**Document Version**: 1.0
**Last Updated**: January 26, 2026
**Maintained By**: Architecture Team
