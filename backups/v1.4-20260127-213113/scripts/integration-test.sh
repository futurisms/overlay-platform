#!/bin/bash

###############################################################################
# Integration Test Suite - v1.2
# Validates all 9 critical bug fixes from v1.2 release
# Run after every deployment to ensure no regressions
###############################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0
FAILURES=()

# Configuration
API_BASE_URL="${API_BASE_URL:-https://wojz5amtrl.execute-api.eu-west-1.amazonaws.com/production}"
AUTH_TOKEN="${AUTH_TOKEN:-}"
TEST_OVERLAY_ID=""
TEST_SESSION_ID=""
TEST_CRITERION_ID=""

###############################################################################
# Helper Functions
###############################################################################

log_info() {
    echo -e "${BLUE}ℹ ${NC}$1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

test_start() {
    TESTS_RUN=$((TESTS_RUN + 1))
    echo ""
    log_info "Test $TESTS_RUN: $1"
}

test_pass() {
    TESTS_PASSED=$((TESTS_PASSED + 1))
    log_success "PASS: $1"
}

test_fail() {
    TESTS_FAILED=$((TESTS_FAILED + 1))
    FAILURES+=("Test $TESTS_RUN: $1")
    log_error "FAIL: $1"
}

check_auth() {
    if [ -z "$AUTH_TOKEN" ]; then
        log_error "AUTH_TOKEN not set. Please set it with:"
        echo "  export AUTH_TOKEN='your-token-here'"
        exit 1
    fi
}

api_get() {
    local endpoint="$1"
    curl -s -X GET "$API_BASE_URL$endpoint" \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        -H "Content-Type: application/json"
}

api_post() {
    local endpoint="$1"
    local data="$2"
    curl -s -X POST "$API_BASE_URL$endpoint" \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$data"
}

api_put() {
    local endpoint="$1"
    local data="$2"
    curl -s -X PUT "$API_BASE_URL$endpoint" \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$data"
}

###############################################################################
# Test Suite
###############################################################################

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║        Integration Test Suite - v1.2 Bug Verification         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
log_info "API Base URL: $API_BASE_URL"
log_info "Starting tests at $(date)"
echo ""

check_auth

###############################################################################
# Test 1: Score Calculation Accuracy (Integration Point #5)
# Verify list view scores match detail view scores
###############################################################################

test_start "Score Calculation Accuracy - List vs Detail Match"

# Get sessions list
SESSIONS_RESPONSE=$(api_get "/sessions")
TEST_SESSION_ID=$(echo "$SESSIONS_RESPONSE" | grep -o '"session_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$TEST_SESSION_ID" ]; then
    test_fail "No sessions found to test"
else
    # Get session detail with submissions
    SESSION_DETAIL=$(api_get "/sessions/$TEST_SESSION_ID")

    # Extract first submission ID and score from detail view
    SUBMISSION_ID=$(echo "$SESSION_DETAIL" | grep -o '"submission_id":"[^"]*"' | head -1 | cut -d'"' -f4)
    DETAIL_SCORE=$(echo "$SESSION_DETAIL" | grep -o '"overall_score":[0-9]*' | head -1 | cut -d':' -f2)

    if [ -z "$SUBMISSION_ID" ]; then
        log_warning "No submissions found in session $TEST_SESSION_ID - skipping score test"
    else
        # Get submissions list for same session
        SUBMISSIONS_LIST=$(api_get "/sessions/$TEST_SESSION_ID/submissions")
        LIST_SCORE=$(echo "$SUBMISSIONS_LIST" | grep -o '"overall_score":[0-9]*' | head -1 | cut -d':' -f2)

        if [ "$DETAIL_SCORE" = "$LIST_SCORE" ]; then
            test_pass "Scores match (List: $LIST_SCORE, Detail: $DETAIL_SCORE)"
        else
            test_fail "Score mismatch - List: $LIST_SCORE, Detail: $DETAIL_SCORE"
        fi
    fi
fi

###############################################################################
# Test 2: Submissions List Visibility (Integration Point #6, #8)
# Verify submissions array is present and matches count
###############################################################################

test_start "Submissions List Visibility - Array Present and Accurate"

if [ -z "$TEST_SESSION_ID" ]; then
    test_fail "No test session ID available"
else
    SESSION_DETAIL=$(api_get "/sessions/$TEST_SESSION_ID")

    # Check if submissions array exists
    if echo "$SESSION_DETAIL" | grep -q '"submissions":\['; then
        # Extract submission_count
        SUBMISSION_COUNT=$(echo "$SESSION_DETAIL" | grep -o '"submission_count":[0-9]*' | cut -d':' -f2)

        # Count actual submissions in array
        ACTUAL_COUNT=$(echo "$SESSION_DETAIL" | grep -o '"submission_id":"[^"]*"' | wc -l)

        if [ "$SUBMISSION_COUNT" = "$ACTUAL_COUNT" ]; then
            test_pass "Submissions array present with correct count ($SUBMISSION_COUNT)"
        else
            test_fail "Count mismatch - Header: $SUBMISSION_COUNT, Actual: $ACTUAL_COUNT"
        fi
    else
        test_fail "Submissions array missing from response"
    fi
fi

###############################################################################
# Test 3: Criteria Persistence (Integration Point #1)
# Create overlay, add criterion, verify it persists
###############################################################################

test_start "Criteria Persistence - Save and Verify in Database"

# Create test overlay
TIMESTAMP=$(date +%s)
CREATE_RESPONSE=$(api_post "/overlays" '{
    "name": "Test Overlay '"$TIMESTAMP"'",
    "description": "Integration test overlay",
    "document_type": "test"
}')

TEST_OVERLAY_ID=$(echo "$CREATE_RESPONSE" | grep -o '"overlay_id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TEST_OVERLAY_ID" ]; then
    test_fail "Failed to create test overlay"
else
    log_info "Created test overlay: $TEST_OVERLAY_ID"

    # Add criterion
    UPDATE_RESPONSE=$(api_put "/overlays/$TEST_OVERLAY_ID" '{
        "name": "Test Overlay '"$TIMESTAMP"'",
        "criteria": [
            {
                "name": "Test Criterion",
                "description": "Integration test criterion",
                "weight": 0.2,
                "max_score": 100,
                "category": "test"
            }
        ]
    }')

    # Wait a moment for database write
    sleep 1

    # Verify criterion persisted
    OVERLAY_DETAIL=$(api_get "/overlays/$TEST_OVERLAY_ID")

    if echo "$OVERLAY_DETAIL" | grep -q '"name":"Test Criterion"'; then
        test_pass "Criterion persisted successfully"
    else
        test_fail "Criterion not found after save"
    fi
fi

###############################################################################
# Test 4: Field Name Consistency (Integration Point #4)
# Verify response uses 'overall_score' not 'avg_score'
###############################################################################

test_start "Field Name Consistency - overall_score vs avg_score"

if [ -z "$TEST_SESSION_ID" ]; then
    test_fail "No test session ID available"
else
    SUBMISSIONS_LIST=$(api_get "/sessions/$TEST_SESSION_ID/submissions")

    # Check for correct field name
    if echo "$SUBMISSIONS_LIST" | grep -q '"overall_score"'; then
        # Check no old field name
        if echo "$SUBMISSIONS_LIST" | grep -q '"avg_score"'; then
            test_fail "Old field name 'avg_score' still present"
        else
            test_pass "Uses correct field name 'overall_score'"
        fi
    else
        test_fail "Field 'overall_score' not found in response"
    fi
fi

###############################################################################
# Test 5: Status Filtering (Integration Point #7)
# Verify only active sessions returned, not archived
###############################################################################

test_start "Status Filtering - Only Active Sessions Returned"

SESSIONS_RESPONSE=$(api_get "/sessions")

# Count sessions with status field
TOTAL_SESSIONS=$(echo "$SESSIONS_RESPONSE" | grep -o '"session_id":"[^"]*"' | wc -l)

# Check if any archived sessions present
ARCHIVED_COUNT=$(echo "$SESSIONS_RESPONSE" | grep -c '"status":"archived"' || true)

if [ "$ARCHIVED_COUNT" -eq 0 ]; then
    test_pass "No archived sessions in list ($TOTAL_SESSIONS active sessions)"
else
    test_fail "Found $ARCHIVED_COUNT archived sessions (should be 0)"
fi

###############################################################################
# Test 6: JSONB Path Safety (Integration Point #6)
# Verify COALESCE handles different JSONB structures
###############################################################################

test_start "JSONB Path Safety - COALESCE Fallback Works"

if [ -z "$TEST_SESSION_ID" ]; then
    test_fail "No test session ID available"
else
    # This test passes if submissions load without SQL errors
    SUBMISSIONS_RESPONSE=$(api_get "/sessions/$TEST_SESSION_ID/submissions")
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$API_BASE_URL/sessions/$TEST_SESSION_ID/submissions" \
        -H "Authorization: Bearer $AUTH_TOKEN")

    if [ "$HTTP_CODE" = "200" ]; then
        test_pass "Submissions endpoint returns 200 (COALESCE working)"
    else
        test_fail "Submissions endpoint returned $HTTP_CODE (COALESCE may be broken)"
    fi
fi

###############################################################################
# Test 7: Complete Response Payloads (Integration Point #8)
# Verify session detail includes all required fields
###############################################################################

test_start "Complete Response Payloads - All Required Fields Present"

if [ -z "$TEST_SESSION_ID" ]; then
    test_fail "No test session ID available"
else
    SESSION_DETAIL=$(api_get "/sessions/$TEST_SESSION_ID")

    MISSING_FIELDS=()

    # Check required fields
    echo "$SESSION_DETAIL" | grep -q '"session_id"' || MISSING_FIELDS+=("session_id")
    echo "$SESSION_DETAIL" | grep -q '"name"' || MISSING_FIELDS+=("name")
    echo "$SESSION_DETAIL" | grep -q '"participants"' || MISSING_FIELDS+=("participants")
    echo "$SESSION_DETAIL" | grep -q '"submissions"' || MISSING_FIELDS+=("submissions")
    echo "$SESSION_DETAIL" | grep -q '"submission_count"' || MISSING_FIELDS+=("submission_count")

    if [ ${#MISSING_FIELDS[@]} -eq 0 ]; then
        test_pass "All required fields present"
    else
        test_fail "Missing fields: ${MISSING_FIELDS[*]}"
    fi
fi

###############################################################################
# Test 8: PostgreSQL Type Casting (Integration Point #9)
# Verify ::jsonb cast is working (no SQL operator errors)
###############################################################################

test_start "PostgreSQL Type Casting - ::jsonb Cast Working"

if [ -z "$TEST_SESSION_ID" ]; then
    test_fail "No test session ID available"
else
    # Test both endpoints that use ::jsonb cast
    SESSION_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$API_BASE_URL/sessions/$TEST_SESSION_ID" \
        -H "Authorization: Bearer $AUTH_TOKEN")

    SUBMISSIONS_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$API_BASE_URL/sessions/$TEST_SESSION_ID/submissions" \
        -H "Authorization: Bearer $AUTH_TOKEN")

    if [ "$SESSION_CODE" = "200" ] && [ "$SUBMISSIONS_CODE" = "200" ]; then
        test_pass "Both endpoints return 200 (no SQL operator errors)"
    else
        test_fail "Error codes - Session: $SESSION_CODE, Submissions: $SUBMISSIONS_CODE"
    fi
fi

###############################################################################
# Test 9: Status Field Presence (Integration Point #3)
# Verify is_active field returned for criteria
###############################################################################

test_start "Status Field Presence - is_active Field Returned"

if [ -z "$TEST_OVERLAY_ID" ]; then
    log_warning "No test overlay - using first available overlay"
    OVERLAYS_RESPONSE=$(api_get "/overlays")
    TEST_OVERLAY_ID=$(echo "$OVERLAYS_RESPONSE" | grep -o '"overlay_id":"[^"]*"' | head -1 | cut -d'"' -f4)
fi

if [ -z "$TEST_OVERLAY_ID" ]; then
    test_fail "No overlay available to test"
else
    OVERLAY_DETAIL=$(api_get "/overlays/$TEST_OVERLAY_ID")

    if echo "$OVERLAY_DETAIL" | grep -q '"is_active":true'; then
        test_pass "Criteria include is_active field"
    else
        test_fail "is_active field missing or false"
    fi
fi

###############################################################################
# Test Results Summary
###############################################################################

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                      Test Results Summary                      ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

log_info "Tests Run:    $TESTS_RUN"
log_success "Tests Passed: $TESTS_PASSED"
if [ $TESTS_FAILED -gt 0 ]; then
    log_error "Tests Failed: $TESTS_FAILED"
else
    log_success "Tests Failed: $TESTS_FAILED"
fi

echo ""

if [ $TESTS_FAILED -gt 0 ]; then
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║                         FAILURES                               ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    for failure in "${FAILURES[@]}"; do
        log_error "$failure"
    done
    echo ""
fi

# Calculate pass rate
PASS_RATE=$(awk "BEGIN {printf \"%.1f\", ($TESTS_PASSED/$TESTS_RUN)*100}")

echo ""
echo "Pass Rate: $PASS_RATE%"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    log_success "✓ ALL TESTS PASSED - Platform is stable"
    echo ""
    log_info "Next steps:"
    echo "  - All v1.2 bug fixes verified working"
    echo "  - Platform ready for normal operations"
    echo "  - Create Q12-Q18 sessions as needed"
    exit 0
else
    log_error "✗ TESTS FAILED - Platform may have issues"
    echo ""
    log_info "Action required:"
    echo "  - Check CloudWatch logs for errors"
    echo "  - Review CRITICAL_INTEGRATION_POINTS.md"
    echo "  - Consider rollback if severity is CRITICAL"
    echo "  - Run manual verification from TESTING_CHECKLIST.md"
    exit 1
fi
