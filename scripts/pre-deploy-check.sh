#!/bin/bash

# 🚀 Pre-Deploy Check Script for avoqado-web-dashboard
# Simula el pipeline de CI/CD localmente antes de hacer push
#
# Usage:
#   npm run pre-deploy              # Run all checks (including E2E)
#   npm run pre-deploy -- --skip-e2e  # Skip Playwright E2E tests

set -e  # Exit on any error

# Parse flags
SKIP_E2E=false
for arg in "$@"; do
  case $arg in
    --skip-e2e) SKIP_E2E=true ;;
  esac
done

TOTAL_STEPS=6
if [ "$SKIP_E2E" = true ]; then
  TOTAL_STEPS=5
fi

echo "🚀 ============================================="
echo "🚀 PRE-DEPLOY VERIFICATION (Dashboard)"
echo "🚀 ============================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

STEP=1

# 1. ESLint (auto-fix first, then check)
echo "📏 Step $STEP/$TOTAL_STEPS: Running ESLint..."
echo "   Auto-fixing issues..."
npm run lint:fix 2>/dev/null || true
echo "   Checking for remaining issues..."
if npm run lint -- --quiet; then
  echo -e "${GREEN}✅ ESLint passed!${NC}"
else
  echo -e "${RED}❌ ESLint failed!${NC}"
  exit 1
fi
echo ""
STEP=$((STEP + 1))

# 2. Check API endpoints
echo "🔗 Step $STEP/$TOTAL_STEPS: Checking API endpoints..."
if npm run check:endpoints; then
  echo -e "${GREEN}✅ Endpoint check passed!${NC}"
else
  echo -e "${RED}❌ Endpoint check failed!${NC}"
  exit 1
fi
echo ""
STEP=$((STEP + 1))

# 3. Build application
echo "🏗️ Step $STEP/$TOTAL_STEPS: Building application..."
if npm run build; then
  echo -e "${GREEN}✅ Build successful!${NC}"
else
  echo -e "${RED}❌ Build failed!${NC}"
  exit 1
fi
echo ""
STEP=$((STEP + 1))

# 4. Playwright E2E tests (skippable)
if [ "$SKIP_E2E" = true ]; then
  echo -e "${YELLOW}⏭️  Skipping E2E tests (--skip-e2e flag)${NC}"
  echo ""
else
  echo "🎭 Step $STEP/$TOTAL_STEPS: Running Playwright E2E tests..."

  # Check if Playwright browsers are installed
  if npx playwright install --dry-run chromium >/dev/null 2>&1 || [ -d "$HOME/Library/Caches/ms-playwright" ] || [ -d "$HOME/.cache/ms-playwright" ]; then
    if npm run test:e2e; then
      echo -e "${GREEN}✅ E2E tests passed!${NC}"
    else
      echo -e "${RED}❌ E2E tests failed!${NC}"
      echo -e "${YELLOW}💡 Run 'npm run test:e2e:ui' to debug interactively${NC}"
      exit 1
    fi
  else
    echo -e "${YELLOW}⚠️  Playwright browsers not installed. Skipping E2E.${NC}"
    echo -e "${YELLOW}   Run 'npx playwright install chromium' to enable E2E tests${NC}"
  fi
  echo ""
  STEP=$((STEP + 1))
fi

# 5. Cross-repo compatibility check
echo "🔗 Step $STEP/$TOTAL_STEPS: Cross-repo compatibility check..."
TPV_PATH="../avoqado-tpv"

if [ -d "$TPV_PATH" ]; then
  echo -e "${YELLOW}⚠️ RECORDATORIO: TPV Android tarda 3-5 días en actualizarse (firma PAX)${NC}"
  echo ""
  echo "   Verifica antes de deploy:"
  echo "   • ¿Esta feature del dashboard afecta config que usa el TPV?"
  echo "   • ¿El backend ya soporta los cambios necesarios?"
  echo ""

  # Show TPV version for context
  TPV_VERSION=$(grep "versionName" "$TPV_PATH/app/build.gradle.kts" 2>/dev/null | head -1 | sed 's/.*"\(.*\)".*/\1/')
  if [ -n "$TPV_VERSION" ]; then
    echo "   TPV actual en producción: v$TPV_VERSION (aprox.)"
  fi
  echo ""
else
  echo "   (avoqado-tpv no encontrado en $TPV_PATH - skipping)"
fi
echo -e "${GREEN}✅ Cross-repo check complete${NC}"
echo ""
STEP=$((STEP + 1))

# 6. Check for uncommitted changes
echo "📝 Step $STEP/$TOTAL_STEPS: Checking git status..."
if [[ -n $(git status -s) ]]; then
  echo -e "${YELLOW}⚠️ You have uncommitted changes:${NC}"
  git status -s
  echo ""
  echo -e "${YELLOW}💡 Consider committing these changes before deploying${NC}"
else
  echo -e "${GREEN}✅ No uncommitted changes${NC}"
fi
echo ""

# Final summary
echo "🎉 ============================================="
echo "🎉 ALL CHECKS PASSED! READY FOR DEPLOY 🚀"
echo "🎉 ============================================="
echo ""
echo "Next steps:"
echo "  1. Commit your changes: git add . && git commit -m 'your message'"
echo "  2. Push to develop: git push origin develop (triggers demo + staging)"
echo "  3. Push to main: git push origin main (triggers production deploy)"
echo ""
