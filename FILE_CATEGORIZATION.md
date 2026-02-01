# File Categorization for Git Commit

## Category 1: MUST COMMIT - Production Code (45 files)

### Frontend Application (40 files)
```
frontend/app/dashboard/page.js
frontend/app/layout.js
frontend/app/login/page.js
frontend/app/page.js
frontend/app/session/[id]/page.js
frontend/app/submission/[id]/page.js
frontend/app/submissions/page.js

frontend/components/TextSelectionHandler.js
frontend/components/sidebar/NotesPanel.js
frontend/components/sidebar/Sidebar.js

frontend/components/ui/alert.js
frontend/components/ui/badge.js
frontend/components/ui/button.js
frontend/components/ui/card.js
frontend/components/ui/dialog.js
frontend/components/ui/input.js
frontend/components/ui/label.js
frontend/components/ui/progress.js
frontend/components/ui/scroll-area.js
frontend/components/ui/separator.js
frontend/components/ui/tabs.js
frontend/components/ui/textarea.js

frontend/contexts/NotesContext.js
frontend/hooks/useNotes.js
frontend/hooks/useTextSelection.js

frontend/lib/api-client.js
frontend/lib/auth.js
frontend/lib/utils.js

frontend/middleware.js
frontend/next.config.js
frontend/proxy-server.js
```

### Backend Infrastructure (7 files)
```
lib/auth-stack.js
lib/compute-stack.js
lib/orchestration-stack.js
lib/overlay-platform-stack.js
lib/storage-stack.js

lambda/layers/common/nodejs/db-client.js
lambda/layers/common/nodejs/llm-client.js
```

### Build & Test (3 files)
```
bin/overlay-platform.js
src/types/index.js
test/overlay-platform.test.js
```

---

## Category 2: SHOULD COMMIT - Documentation (4 files)

```
CURRENT_PRODUCTION_TEST.md
DATABASE_DEPENDENCIES.md
DELETE_FEATURE_IMPLEMENTATION.md
TEST_PLAN.md
```

---

## Category 3: SHOULD COMMIT - Utility Scripts (5 files)

Essential operational scripts:
```
scripts/create-admin-user.js
scripts/seed-llm-config.js
scripts/invoke-migration-lambda.js
scripts/run-migrations.js
scripts/query-results.js
```

---

## Category 4: IGNORE - Temporary Files (55+ files)

### Backup Directories
```
lambda/functions-before-final-restore-20260131-221422/
lambda/functions-before-restore-20260131-220231/
```

### Root-Level Diagnostic Scripts
```
apply-migration-008.js
check-session.js
check-test-submission.js
debug-query.sql
investigate-criteria-bug.js
response.json
run-query.js
test-criteria-save.js
test-db-query.js
test-dynamodb.js
test-paste-submission.js
test-s3.js
verify-migration-008.js
```

### Diagnostic Baselines
```
aws-baseline-20260201.txt
```

### Scripts - Diagnostic/Testing (40+ files)
```
scripts/add-overlay-context-fields.js
scripts/check-appendix-data.js
scripts/check-criteria-issue.js
scripts/check-feedback.js
scripts/check-overlays.js
scripts/check-recent-logs.js
scripts/check-scoring-logs.js
scripts/check-sessions.js
scripts/check-submission-logs.js
scripts/check-submission-status.js
scripts/check-submissions.js
scripts/compare-feedback-data.js
scripts/comprehensive-api-test.js
scripts/debug-notes.js
scripts/end-to-end-test.js
scripts/find-creation-log.js
scripts/get-logs-by-time.js
scripts/invoke-db-query.js
scripts/query-appendix-via-lambda.js
scripts/query-submission.js
scripts/query-tokens.js
scripts/query-user-notes.js
scripts/run-migration.js
scripts/test-api-endpoints.js
scripts/test-api.js
scripts/test-appendix-api.js
scripts/test-criteria-fix.js
scripts/test-download-endpoints.js
scripts/test-feedback-endpoint.js
scripts/test-feedback-for-submission.js
scripts/test-frontend-api.js
scripts/test-llm-config.js
scripts/test-new-endpoints.js
scripts/test-paste-text-submission.js
scripts/test-score-display.js
scripts/test-status-fix.js
scripts/test-submission-get.js
scripts/test-workflow.js
scripts/verify-appendix-submission.js
scripts/verify-cors-fix.js
```

---

## Summary

- **Category 1 (Production):** 50 files → COMMIT
- **Category 2 (Documentation):** 4 files → COMMIT
- **Category 3 (Utilities):** 5 files → COMMIT
- **Category 4 (Temporary):** 55+ files → IGNORE

**Total to Commit:** 59 files
**Total to Ignore:** 55+ files
