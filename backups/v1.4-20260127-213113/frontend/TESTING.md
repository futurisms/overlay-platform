# Overlay Platform - Frontend Testing Guide

## Overview

This functional frontend allows you to test the Overlay Platform backend end-to-end, including:
- Document upload
- AI processing workflows
- Feedback retrieval
- Clarification questions and answers

## Running the Frontend

1. **Start the development server:**
   ```bash
   cd c:\Projects\overlay-platform\frontend
   npm run dev
   ```

2. **Access the application:**
   - Open your browser to: http://localhost:3000
   - You'll be redirected to the login page

## Test Credentials

**Email:** admin@example.com
**Password:** TestPassword123!

This account has admin privileges and can access all features.

## Testing Workflow

### 1. Login
- Navigate to http://localhost:3000/login
- Enter the test credentials
- Click "Sign In"
- You'll be redirected to the dashboard

### 2. View Available Sessions
- The dashboard shows all available review sessions from the backend
- Each session card displays:
  - Session name and description
  - Status (active/pending/completed)
  - Participant count
  - Submission count
  - Start and end dates
  - Creator name

### 3. Select a Session
- Click on any session card to open the session detail page
- The session page shows:
  - Session information
  - Document upload interface
  - List of all submissions in the session

### 4. Upload a Document
- On the session page, click "Click to upload or drag and drop"
- Select a document file (PDF, DOCX, DOC, or TXT)
- Click "Upload Document"
- The document will be:
  - Uploaded to S3
  - Stored in the database
  - Queued for AI processing via Step Functions

### 5. Monitor Processing Status
- After uploading, refresh the submissions list
- Each submission shows:
  - Document name
  - Submission status
  - AI analysis status (pending → in_progress → completed → failed)
  - Overall score (when analysis completes)

### 6. View Analysis Results
- Click on any submission with completed analysis
- The submission detail page shows:
  - Overall score (0-100)
  - Detailed feedback
  - Strengths (positive findings)
  - Weaknesses (issues found)
  - Recommendations (action items)
  - Clarification questions

### 7. Answer Clarification Questions
- On the submission detail page, scroll to "Clarification Questions"
- Each question shows:
  - Priority (high/medium/low)
  - Question text
  - Any existing answers
- Type your answer in the text area
- Click "Submit Answer"
- Your answer will be saved and displayed

## Architecture

### Frontend Pages

1. **[/login](http://localhost:3000/login)** - Authentication page
2. **[/dashboard](http://localhost:3000/dashboard)** - Main dashboard with available sessions
3. **[/session/[id]](http://localhost:3000/session/)** - Session detail with upload and submissions
4. **[/submission/[id]](http://localhost:3000/submission/)** - Submission detail with AI analysis

### Key Components

- **API Client** ([lib/api-client.ts](lib/api-client.ts)) - All backend API calls
- **Auth Utility** ([lib/auth.ts](lib/auth.ts)) - Cognito authentication
- **UI Components** (components/ui/*) - shadcn/ui components

### API Integration

The frontend connects to:
- **API Gateway:** https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production
- **Cognito User Pool:** eu-west-1_lC25xZ8s6

All API calls include the JWT token from Cognito in the Authorization header.

## API Endpoints Used

### Sessions
- GET /sessions/available - List available sessions
- GET /sessions/{id} - Get session details
- GET /sessions/{id}/submissions - List session submissions

### Submissions
- GET /submissions - List all submissions
- GET /submissions/{id} - Get submission details
- POST /submissions - Upload new document
- GET /submissions/{id}/feedback - Get AI analysis results

### Answers
- GET /submissions/{id}/answers - Get clarification questions
- POST /submissions/{id}/answers - Submit an answer

## Environment Variables

The API base URL is configured in `.env.local`:

```
NEXT_PUBLIC_API_BASE_URL=https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production
```

## Testing Scenarios

### Scenario 1: Upload and Analyze Document
1. Login with test credentials
2. Select an active session
3. Upload a test document (e.g., a sample contract)
4. Wait for AI processing (check status every 30 seconds)
5. View the completed analysis with scores, strengths, weaknesses

### Scenario 2: Answer Clarification Questions
1. Find a submission with completed analysis
2. Scroll to clarification questions
3. Answer each high-priority question
4. Verify answers are saved and displayed

### Scenario 3: Compare Multiple Submissions
1. Upload 2-3 documents to the same session
2. Compare their scores and feedback
3. Identify patterns in strengths/weaknesses

## Troubleshooting

### Login Issues
- **Error:** "Authentication failed"
- **Solution:** Verify Cognito credentials are correct, check network connectivity

### Upload Issues
- **Error:** "Failed to upload document"
- **Solution:** Check file size (max 10MB), verify file type is supported

### Analysis Not Starting
- **Issue:** Submission status stuck at "pending"
- **Solution:** Check Step Functions workflow is running, verify Lambda functions are deployed

### Missing Feedback
- **Issue:** Submission shows "completed" but no feedback
- **Solution:** Check ai_agent_results table in database, verify scoring agent ran successfully

## Development

### Adding New Pages
1. Create a new file in `app/` directory
2. Use "use client" directive for client-side functionality
3. Import API client and auth utilities
4. Follow the existing page patterns

### Styling
- Uses Tailwind CSS for styling
- Dark mode supported via dark: variants
- Components from shadcn/ui library

### TypeScript
- All files use TypeScript
- No strict type checking (can improve with interfaces)
- Runtime type checking with API responses

## Next Steps

This frontend is designed for testing, not production. To prepare for production:

1. **Add proper error handling** - Better error messages and recovery
2. **Add loading states** - More granular loading indicators
3. **Add validation** - Client-side form validation
4. **Add pagination** - For large lists of sessions/submissions
5. **Add filtering/search** - Find specific sessions or submissions
6. **Add user profiles** - View/edit user information
7. **Add notifications** - Real-time updates on analysis completion
8. **Add download reports** - Export analysis as PDF
9. **Add admin features** - Manage sessions, users, overlays
10. **Add testing** - Unit tests, integration tests, E2E tests

## Backend Status

All backend endpoints are working:
- ✅ 39 API endpoints deployed
- ✅ 6 AI agents operational
- ✅ Step Functions workflow running
- ✅ Cognito authentication configured
- ✅ Database seeded with sample data

## Support

For issues or questions:
1. Check the main project README
2. Review CLAUDE.md for implementation status
3. Check backend logs in CloudWatch
4. Test endpoints with scripts/test-new-endpoints.js
