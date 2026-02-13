# Architecture Diagrams — v1.1

## Full System Architecture

```mermaid
graph TB
    User[User Browser]
    Vercel[Next.js Frontend<br/>Vercel Hosting]
    Proxy[Dev Proxy Server<br/>localhost:3001<br/>CORS Handler]
    APIGW[AWS API Gateway<br/>wojz5amtrl<br/>eu-west-1]

    subgraph "API Lambda Functions"
        Auth[overlay-api-auth<br/>512MB 30s]
        Sessions[overlay-api-sessions<br/>512MB 30s]
        Submissions[overlay-api-submissions<br/>512MB 60s]
        Overlays[overlay-api-overlays<br/>512MB 30s]
        Users[overlay-api-users<br/>256MB 30s]
        Invitations[overlay-api-invitations<br/>512MB 30s]
        Admin[overlay-api-admin<br/>512MB 30s]
        Notes[overlay-api-notes<br/>512MB 30s]
        Annotate[overlay-api-annotate-document<br/>1024MB 300s]
    end

    subgraph "AI Agent Lambda Functions"
        Structure[structure-validator<br/>512MB 120s]
        Content[content-analyzer<br/>1024MB 300s]
        Grammar[grammar-checker<br/>512MB 120s]
        Clarify[clarification<br/>1024MB 180s]
        Orchestrator[orchestrator<br/>1024MB 300s]
        Scoring[scoring<br/>512MB 180s]
    end

    StepFn[Step Functions<br/>6-Agent Workflow<br/>State Machine]
    Layer[Lambda Layer<br/>db-utils<br/>llm-client<br/>cors<br/>permissions]

    Aurora[(Aurora PostgreSQL 16.6<br/>Serverless v2<br/>Private VPC)]
    S3[(S3 Bucket<br/>overlay-docs<br/>Document Storage)]
    Cognito[Cognito User Pool<br/>eu-west-1_lC25xZ8s6<br/>JWT Authentication]
    Claude[Claude API<br/>Sonnet 4.5<br/>Anthropic]
    CloudWatch[CloudWatch<br/>Logs & Metrics]

    User -->|HTTPS| Vercel
    Vercel -->|Dev| Proxy
    Vercel -->|Prod| APIGW
    Proxy -->|Prod API| APIGW

    APIGW --> Auth
    APIGW --> Sessions
    APIGW --> Submissions
    APIGW --> Overlays
    APIGW --> Users
    APIGW --> Invitations
    APIGW --> Admin
    APIGW --> Notes
    APIGW --> Annotate

    Submissions -->|Trigger| StepFn
    StepFn --> Structure
    StepFn --> Content
    StepFn --> Grammar
    StepFn --> Clarify
    StepFn --> Orchestrator
    StepFn --> Scoring

    Auth -.->|Uses| Layer
    Sessions -.->|Uses| Layer
    Submissions -.->|Uses| Layer
    Overlays -.->|Uses| Layer
    Users -.->|Uses| Layer
    Invitations -.->|Uses| Layer
    Admin -.->|Uses| Layer
    Notes -.->|Uses| Layer
    Annotate -.->|Uses| Layer

    Structure -.->|Uses| Layer
    Content -.->|Uses| Layer
    Grammar -.->|Uses| Layer
    Clarify -.->|Uses| Layer
    Orchestrator -.->|Uses| Layer
    Scoring -.->|Uses| Layer

    Auth --> Aurora
    Sessions --> Aurora
    Submissions --> Aurora
    Overlays --> Aurora
    Users --> Aurora
    Invitations --> Aurora
    Admin --> Aurora
    Notes --> Aurora
    Annotate --> Aurora

    Structure --> Aurora
    Content --> Aurora
    Grammar --> Aurora
    Clarify --> Aurora
    Orchestrator --> Aurora
    Scoring --> Aurora

    Submissions --> S3
    Annotate --> S3

    Auth --> Cognito
    Invitations --> Cognito

    Structure --> Claude
    Content --> Claude
    Grammar --> Claude
    Clarify --> Claude
    Orchestrator --> Claude
    Scoring --> Claude
    Annotate --> Claude

    Auth -.->|Logs| CloudWatch
    Sessions -.->|Logs| CloudWatch
    Submissions -.->|Logs| CloudWatch
    Overlays -.->|Logs| CloudWatch
    Structure -.->|Logs| CloudWatch
    Content -.->|Logs| CloudWatch
    Grammar -.->|Logs| CloudWatch
    Clarify -.->|Logs| CloudWatch
    Orchestrator -.->|Logs| CloudWatch
    Scoring -.->|Logs| CloudWatch
    Annotate -.->|Logs| CloudWatch

    style Vercel fill:#0070f3
    style APIGW fill:#ff9900
    style Aurora fill:#336791
    style S3 fill:#569a31
    style Cognito fill:#dd344c
    style Claude fill:#8e75ff
    style CloudWatch fill:#ff9900
    style StepFn fill:#ff9900
```

---

## AI Agent Pipeline Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API as API Gateway
    participant SubmissionsLambda
    participant S3
    participant StepFunctions
    participant Validator as structure-validator
    participant Analyzer as content-analyzer
    participant Grammar as grammar-checker
    participant Clarify as clarification
    participant Orch as orchestrator
    participant Scoring as scoring
    participant Claude as Claude API
    participant DB as Aurora PostgreSQL

    User->>Frontend: Upload document
    Frontend->>API: POST /submissions
    API->>SubmissionsLambda: Invoke
    SubmissionsLambda->>S3: Store document
    S3-->>SubmissionsLambda: S3 key
    SubmissionsLambda->>DB: Create submission record
    SubmissionsLambda->>StepFunctions: StartExecution
    SubmissionsLambda-->>Frontend: 201 Created
    Frontend-->>User: Success message

    Note over StepFunctions,Scoring: 6-Agent Sequential Workflow

    StepFunctions->>Validator: Invoke (1/6)
    Validator->>S3: Get document
    Validator->>Claude: Analyze structure
    Claude-->>Validator: Structure score
    Validator->>DB: Save feedback
    Validator-->>StepFunctions: Result

    StepFunctions->>Analyzer: Invoke (2/6)
    Analyzer->>S3: Get document
    Analyzer->>Claude: Analyze content
    Claude-->>Analyzer: Content score
    Analyzer->>DB: Save feedback
    Analyzer-->>StepFunctions: Result

    StepFunctions->>Grammar: Invoke (3/6)
    Grammar->>S3: Get document
    Grammar->>Claude: Check grammar
    Claude-->>Grammar: Grammar score
    Grammar->>DB: Save feedback
    Grammar-->>StepFunctions: Result

    StepFunctions->>Clarify: Invoke (4/6)
    Clarify->>Claude: Generate questions
    Claude-->>Clarify: Questions (if any)
    Clarify->>DB: Save questions
    Clarify-->>StepFunctions: Result

    StepFunctions->>Orch: Invoke (5/6)
    Orch->>DB: Get all results
    Orch->>Claude: Summarize
    Claude-->>Orch: Summary
    Orch->>DB: Save summary
    Orch-->>StepFunctions: Result

    StepFunctions->>Scoring: Invoke (6/6)
    Scoring->>DB: Get all results + criteria
    Scoring->>Claude: Calculate final scores
    Claude-->>Scoring: Scores + feedback
    Scoring->>DB: Save scores + report
    Scoring->>DB: Update submission status
    Scoring-->>StepFunctions: Complete

    Note over Frontend,User: Frontend polls every 3s
    Frontend->>API: GET /submissions/{id}
    API->>SubmissionsLambda: Invoke
    SubmissionsLambda->>DB: Get submission
    DB-->>SubmissionsLambda: Status + scores
    SubmissionsLambda-->>Frontend: Submission data
    Frontend-->>User: Display results
```

---

## Async Annotation Flow (Lambda Self-Invocation)

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API as API Gateway
    participant AnnotateLambda as annotate-document Lambda
    participant AnnotateWorker as annotate-document Lambda<br/>(Background Worker)
    participant S3
    participant Claude as Claude API
    participant DB as Aurora PostgreSQL

    User->>Frontend: Click "Generate Annotation"
    Frontend->>API: GET /submissions/{id}/annotate
    API->>AnnotateLambda: Invoke (Main Handler)

    Note over AnnotateLambda: Check if annotation exists
    AnnotateLambda->>DB: Query document_annotations
    DB-->>AnnotateLambda: Status (null/generating/completed)

    alt Annotation exists
        AnnotateLambda-->>Frontend: 200 OK {status: "completed"}
        Frontend-->>User: Show "Download" button
    else Annotation generating
        AnnotateLambda-->>Frontend: 202 Accepted {status: "generating"}
        Frontend-->>User: Show "Generating..." message
    else No annotation
        Note over AnnotateLambda: Create placeholder record
        AnnotateLambda->>DB: INSERT document_annotations<br/>generation_status='generating'
        DB-->>AnnotateLambda: annotation_id

        Note over AnnotateLambda: Lambda self-invocation (async)
        AnnotateLambda->>AnnotateWorker: InvokeCommand<br/>InvocationType='Event'<br/>{isWorker: true, ...}
        AnnotateLambda-->>API: 202 Accepted
        API-->>Frontend: 202 Accepted {status: "generating"}
        Frontend-->>User: Show "Generating..." message

        Note over AnnotateWorker: Background processing (5min timeout)
        AnnotateWorker->>DB: Get submission + feedback
        AnnotateWorker->>S3: Get document text
        AnnotateWorker->>Claude: Generate annotation<br/>(sandwich format)
        Claude-->>AnnotateWorker: Annotated JSON
        AnnotateWorker->>DB: UPDATE document_annotations<br/>annotated_json, tokens,<br/>generation_status='completed'
        AnnotateWorker->>DB: INSERT token_usage<br/>(admin cost tracking)

        Note over Frontend: Frontend polls every 3s
        loop Polling until complete
            Frontend->>API: GET /submissions/{id}/annotate
            API->>AnnotateLambda: Invoke
            AnnotateLambda->>DB: Query document_annotations
            DB-->>AnnotateLambda: Status='generating'
            AnnotateLambda-->>Frontend: 202 Accepted
            Note over Frontend: Wait 3 seconds
        end

        AnnotateWorker->>DB: Final status update

        Frontend->>API: GET /submissions/{id}/annotate
        API->>AnnotateLambda: Invoke
        AnnotateLambda->>DB: Query document_annotations
        DB-->>AnnotateLambda: Status='completed'
        AnnotateLambda-->>Frontend: 200 OK {status: "completed"}
        Frontend-->>User: Show "Download" button
    end

    User->>Frontend: Click "Download"
    Frontend->>API: GET /submissions/{id}/annotate/download
    API->>AnnotateLambda: Invoke
    AnnotateLambda->>DB: Get annotation JSON
    AnnotateLambda->>S3: Generate presigned URL<br/>(15min expiry)
    S3-->>AnnotateLambda: Presigned URL
    AnnotateLambda-->>Frontend: 200 OK {downloadUrl}
    Frontend->>S3: Download DOCX
    S3-->>Frontend: File stream
    Frontend-->>User: File download starts
```

---

## Authentication Flow (Cognito → JWT → API Gateway)

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API as API Gateway
    participant AuthLambda
    participant Cognito as Cognito User Pool
    participant DB as Aurora PostgreSQL
    participant OtherLambda as Any Protected Lambda

    Note over User,DB: Login Flow
    User->>Frontend: Enter email + password
    Frontend->>API: POST /auth<br/>{action: "login"}
    API->>AuthLambda: Invoke
    AuthLambda->>Cognito: AdminInitiateAuth
    Cognito-->>AuthLambda: ID Token + Access Token
    AuthLambda-->>API: 200 OK {idToken}
    API-->>Frontend: JWT token
    Frontend->>Frontend: Store in localStorage
    Frontend->>DB: GET /users/me
    DB-->>Frontend: User role from PostgreSQL
    Frontend->>Frontend: Store user info
    Frontend-->>User: Redirect to dashboard

    Note over User,OtherLambda: Protected API Call
    User->>Frontend: Access protected resource
    Frontend->>API: GET /sessions<br/>Authorization: Bearer {jwt}
    API->>API: Extract JWT claims<br/>sub, email, groups
    API->>OtherLambda: Invoke with user context<br/>requestContext.authorizer.claims
    OtherLambda->>DB: Query with user_id from JWT
    DB-->>OtherLambda: Filtered data
    OtherLambda-->>API: 200 OK {data}
    API-->>Frontend: Response
    Frontend-->>User: Display data

    Note over User,Cognito: Forgot Password Flow (v1.1)
    User->>Frontend: Click "Forgot password?"
    Frontend->>API: POST /auth<br/>{action: "forgotPassword"}
    API->>AuthLambda: Invoke
    AuthLambda->>Cognito: ForgotPasswordCommand
    Cognito->>User: Email with 6-digit code
    AuthLambda-->>Frontend: 200 OK
    Frontend-->>User: Show code entry form
    User->>Frontend: Enter code + new password
    Frontend->>API: POST /auth<br/>{action: "confirmForgotPassword"}
    API->>AuthLambda: Invoke
    AuthLambda->>Cognito: ConfirmForgotPasswordCommand
    Cognito-->>AuthLambda: Success
    AuthLambda-->>Frontend: 200 OK
    Frontend-->>User: Show success message

    Note over User,DB: Token Expiry & Refresh
    User->>Frontend: API call (token expired)
    Frontend->>API: GET /sessions<br/>Authorization: Bearer {expired_jwt}
    API-->>Frontend: 401 Unauthorized
    Frontend->>Frontend: Clear localStorage
    Frontend-->>User: Redirect to login
```

---

## Database Entity Relationships

```mermaid
erDiagram
    organizations ||--o{ users : has
    organizations ||--o{ overlays : owns

    users ||--o{ review_sessions : creates
    users ||--o{ document_submissions : submits
    users ||--o{ session_participants : participates
    users ||--o{ user_invitations : invites
    users ||--o{ user_notes : writes

    overlays ||--o{ review_sessions : configures
    overlays ||--o{ evaluation_criteria : defines
    overlays ||--o{ document_submissions : evaluates

    review_sessions ||--o{ document_submissions : contains
    review_sessions ||--o{ session_participants : has
    review_sessions ||--o{ user_invitations : invites_to

    document_submissions ||--o{ feedback_reports : generates
    document_submissions ||--o{ evaluation_responses : scores
    document_submissions ||--o{ token_usage : tracks
    document_submissions ||--o| document_annotations : annotates

    evaluation_criteria ||--o{ evaluation_responses : evaluates

    organizations {
        uuid organization_id PK
        string name
        string domain
        timestamptz created_at
    }

    users {
        uuid user_id PK "Cognito sub"
        uuid organization_id FK
        string email
        string first_name
        string last_name
        string user_role "admin/analyst"
        timestamptz created_at
    }

    overlays {
        uuid overlay_id PK
        uuid organization_id FK
        string name
        text description
        string document_type
        text document_purpose
        text target_audience
        boolean is_active
    }

    evaluation_criteria {
        uuid criteria_id PK
        uuid overlay_id FK
        string name
        text description
        string criterion_type
        integer weight
        integer max_score
        integer display_order
    }

    review_sessions {
        uuid session_id PK
        uuid overlay_id FK
        uuid created_by FK
        string name
        text description
        string status
        date start_date
        date end_date
        string project_name
    }

    session_participants {
        uuid user_id PK,FK
        uuid session_id PK,FK
        string role "reviewer/owner"
        string status "active/removed"
        uuid invited_by FK
    }

    document_submissions {
        uuid submission_id PK
        uuid session_id FK
        uuid overlay_id FK
        uuid submitted_by FK
        string document_name
        string s3_key
        integer file_size
        jsonb appendix_files
        string status
        string ai_analysis_status
        integer overall_score
    }

    feedback_reports {
        uuid report_id PK
        uuid submission_id FK
        string report_type "comment/issue/warning"
        string title
        jsonb content
        string severity
    }

    evaluation_responses {
        uuid response_id PK
        uuid submission_id FK
        uuid criteria_id FK
        integer score
        text reasoning
        string evaluated_by "ai-agent/manual"
    }

    token_usage {
        uuid token_usage_id PK
        uuid submission_id FK
        string agent_name
        integer input_tokens
        integer output_tokens
        integer total_tokens "GENERATED"
        decimal cost_usd "GENERATED"
        string model_name
        timestamptz created_at
    }

    document_annotations {
        uuid annotation_id PK
        uuid submission_id FK
        jsonb annotated_json
        string generation_status "generating/completed/failed"
        integer input_tokens
        integer output_tokens
        string model_used
        integer generation_time_ms
    }

    user_notes {
        uuid note_id PK
        uuid user_id FK
        uuid session_id FK
        string title
        text content
        text ai_summary
        timestamptz created_at
        timestamptz updated_at
    }

    user_invitations {
        uuid invitation_id PK
        uuid session_id FK
        uuid invited_by FK
        string email
        string token
        timestamptz expires_at
        uuid accepted_by FK
        timestamptz accepted_at
    }
```

---

## CDK Stack Architecture

```mermaid
graph TB
    subgraph "OverlayStorageStack"
        VPC[VPC<br/>Private Subnets]
        Aurora[Aurora PostgreSQL<br/>Serverless v2]
        S3[S3 Bucket<br/>Document Storage]
        DynamoDB[DynamoDB<br/>LLM Config]
        SecretsManager[Secrets Manager<br/>DB Credentials<br/>Claude API Key]
        MigrationLambda[Database Migration<br/>Lambda]
    end

    subgraph "OverlayAuthStack"
        UserPool[Cognito User Pool<br/>Users]
        UserPoolClient[User Pool Client<br/>Web App]
        SystemAdminGroup[system_admin Group]
        DocumentAdminGroup[document_admin Group]
        EndUserGroup[end_user Group]
        PreSignupTrigger[Pre-Signup Lambda<br/>Auto-confirm]
        PostAuthTrigger[Post-Auth Lambda<br/>Audit Logging]
    end

    subgraph "OverlayComputeStack"
        ApiGateway[API Gateway<br/>REST API]
        AuthHandler[Auth Lambda]
        SessionsHandler[Sessions Lambda]
        SubmissionsHandler[Submissions Lambda]
        OverlaysHandler[Overlays Lambda]
        UsersHandler[Users Lambda]
        InvitationsHandler[Invitations Lambda]
        AdminHandler[Admin Lambda]
        NotesHandler[Notes Lambda]
        AnnotateHandler[Annotate Lambda]
    end

    subgraph "OverlayOrchestrationStack"
        LambdaLayer[Lambda Layer<br/>db-utils<br/>llm-client<br/>cors<br/>permissions]
        StructureAgent[structure-validator<br/>Agent]
        ContentAgent[content-analyzer<br/>Agent]
        GrammarAgent[grammar-checker<br/>Agent]
        ClarifyAgent[clarification<br/>Agent]
        OrchestratorAgent[orchestrator<br/>Agent]
        ScoringAgent[scoring<br/>Agent]
        StepFunctionsMachine[Step Functions<br/>State Machine]
    end

    OverlayStorageStack --> OverlayAuthStack
    OverlayAuthStack --> OverlayComputeStack
    OverlayComputeStack --> OverlayOrchestrationStack

    Aurora --> VPC
    MigrationLambda --> VPC
    MigrationLambda --> Aurora
    MigrationLambda --> SecretsManager

    UserPool --> SystemAdminGroup
    UserPool --> DocumentAdminGroup
    UserPool --> EndUserGroup
    UserPool --> PreSignupTrigger
    UserPool --> PostAuthTrigger

    ApiGateway --> AuthHandler
    ApiGateway --> SessionsHandler
    ApiGateway --> SubmissionsHandler
    ApiGateway --> OverlaysHandler
    ApiGateway --> UsersHandler
    ApiGateway --> InvitationsHandler
    ApiGateway --> AdminHandler
    ApiGateway --> NotesHandler
    ApiGateway --> AnnotateHandler

    AuthHandler -.->|Uses| LambdaLayer
    SessionsHandler -.->|Uses| LambdaLayer
    SubmissionsHandler -.->|Uses| LambdaLayer
    OverlaysHandler -.->|Uses| LambdaLayer
    UsersHandler -.->|Uses| LambdaLayer
    InvitationsHandler -.->|Uses| LambdaLayer
    AdminHandler -.->|Uses| LambdaLayer
    NotesHandler -.->|Uses| LambdaLayer
    AnnotateHandler -.->|Uses| LambdaLayer

    StructureAgent -.->|Uses| LambdaLayer
    ContentAgent -.->|Uses| LambdaLayer
    GrammarAgent -.->|Uses| LambdaLayer
    ClarifyAgent -.->|Uses| LambdaLayer
    OrchestratorAgent -.->|Uses| LambdaLayer
    ScoringAgent -.->|Uses| LambdaLayer

    StepFunctionsMachine --> StructureAgent
    StepFunctionsMachine --> ContentAgent
    StepFunctionsMachine --> GrammarAgent
    StepFunctionsMachine --> ClarifyAgent
    StepFunctionsMachine --> OrchestratorAgent
    StepFunctionsMachine --> ScoringAgent

    SubmissionsHandler -->|Triggers| StepFunctionsMachine

    style VPC fill:#ff9900
    style Aurora fill:#336791
    style S3 fill:#569a31
    style UserPool fill:#dd344c
    style ApiGateway fill:#ff9900
    style LambdaLayer fill:#ff9900
    style StepFunctionsMachine fill:#ff9900
```

---

## Deployment Flow

```mermaid
graph LR
    Dev[Developer]
    Git[GitHub Repository<br/>master branch]
    CDK[AWS CDK CLI]
    CloudFormation[AWS CloudFormation]
    Vercel[Vercel Platform]

    subgraph "Backend Deployment"
        Storage[OverlayStorageStack<br/>Database, VPC, S3]
        Auth[OverlayAuthStack<br/>Cognito]
        Compute[OverlayComputeStack<br/>API Lambdas]
        Orchestration[OverlayOrchestrationStack<br/>AI Agents]
    end

    subgraph "Frontend Deployment"
        VercelBuild[Vercel Build<br/>Next.js]
        VercelDeploy[Vercel Deploy<br/>CDN]
    end

    Dev -->|git push| Git
    Dev -->|cdk deploy| CDK
    CDK --> CloudFormation
    CloudFormation --> Storage
    CloudFormation --> Auth
    CloudFormation --> Compute
    CloudFormation --> Orchestration

    Git -->|Webhook| Vercel
    Vercel --> VercelBuild
    VercelBuild --> VercelDeploy

    VercelDeploy -->|API Calls| Compute
    VercelDeploy -->|Auth| Auth
    Compute -->|Data| Storage
    Compute -->|Workflow| Orchestration

    style Git fill:#333
    style CDK fill:#ff9900
    style Vercel fill:#0070f3
```

---

## End of Document

**Document Version**: v1.1
**Created**: February 13, 2026
**Purpose**: Visual architecture reference for developers and stakeholders
