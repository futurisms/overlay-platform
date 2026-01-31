#!/bin/bash

set -e

echo "🔄 Rolling back token tracking implementation..."

PHASE=${1:-all}

rollback_phase_1() {
  echo "📦 Rolling back Phase 1 (Database)..."

  # Run rollback migration via Lambda
  aws lambda invoke \
    --function-name overlay-database-migration \
    --payload '{"migrationFile": "rollback-006_token_tracking.sql"}' \
    --cli-binary-format raw-in-base64-out \
    response.json

  cat response.json
  echo ""
  echo "✅ Phase 1 rollback complete"
}

rollback_phase_2() {
  echo "📦 Rolling back Phase 2 (Lambda Layer)..."

  cd lambda/layers/common/nodejs
  git checkout HEAD~1 llm-client.js
  cd ../../../..

  echo "Redeploying OrchestrationStack..."
  cdk deploy OverlayOrchestrationStack --require-approval never

  echo "✅ Phase 2 rollback complete"
}

rollback_phase_3() {
  echo "📦 Rolling back Phase 3 (AI Agents)..."

  cd lambda/functions/step-functions
  for agent in structure-validator grammar-checker clarification content-analyzer scoring orchestrator; do
    echo "Reverting $agent..."
    cd $agent
    git checkout HEAD~1 index.js || true
    cd ..
  done
  cd ../../..

  echo "Redeploying OrchestrationStack..."
  cdk deploy OverlayOrchestrationStack --require-approval never

  echo "✅ Phase 3 rollback complete"
}

rollback_phase_4() {
  echo "📦 Rolling back Phase 4 (API Endpoints)..."

  cd lambda/functions/api/submissions
  git checkout HEAD~1 index.js
  cd ../../../..

  echo "Redeploying ComputeStack..."
  cdk deploy OverlayComputeStack --require-approval never

  echo "✅ Phase 4 rollback complete"
}

rollback_phase_5() {
  echo "📦 Rolling back Phase 5 (Frontend)..."

  cd frontend
  git checkout HEAD~1 lib/api-client.ts || true
  git checkout HEAD~1 app/session/ || true
  git checkout HEAD~1 app/submission/ || true
  git checkout HEAD~1 components/analytics/ || true

  echo "Rebuilding frontend..."
  npm run build

  echo "✅ Phase 5 rollback complete"
}

case $PHASE in
  1)
    rollback_phase_1
    ;;
  2)
    rollback_phase_2
    ;;
  3)
    rollback_phase_3
    ;;
  4)
    rollback_phase_4
    ;;
  5)
    rollback_phase_5
    ;;
  all)
    echo "Rolling back all phases in reverse order..."
    rollback_phase_5
    rollback_phase_4
    rollback_phase_3
    rollback_phase_2
    rollback_phase_1
    echo "🎉 Full rollback complete"
    ;;
  *)
    echo "Usage: $0 {1|2|3|4|5|all}"
    echo ""
    echo "Examples:"
    echo "  $0 1      # Rollback only Phase 1 (Database)"
    echo "  $0 3      # Rollback only Phase 3 (AI Agents)"
    echo "  $0 all    # Rollback all phases"
    exit 1
    ;;
esac

echo ""
echo "✅ Rollback complete. Test system stability:"
echo "   - Check Q12-Q17 submissions still working"
echo "   - Verify CloudWatch logs clear of errors"
echo "   - Test dashboard pages loading correctly"
