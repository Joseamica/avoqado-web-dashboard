#!/bin/bash

# 🚀 Pre-Deploy Check Script for avoqado-web-dashboard
# Simula el pipeline de CI/CD localmente antes de hacer push
#
# Usage:
#   npm run pre-deploy
#   npm run pre-deploy -- --skip-e2e
#   npm run pre-deploy -- --smart
#   npm run pre-deploy -- --smart --jobs=3
#   npm run pre-deploy -- --smart --max-old-space-size=8192

set -euo pipefail

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Flags
SKIP_E2E=false
SMART_MODE=false
JOBS=3
MAX_OLD_SPACE_SIZE=""
SMART_LOG_DIR=""

for arg in "$@"; do
  case $arg in
    --skip-e2e)
      SKIP_E2E=true
      ;;
    --smart)
      SMART_MODE=true
      ;;
    --jobs=*)
      JOBS="${arg#*=}"
      ;;
    --max-old-space-size=*)
      MAX_OLD_SPACE_SIZE="${arg#*=}"
      ;;
    --help|-h)
      echo "Usage: npm run pre-deploy -- [--skip-e2e] [--smart] [--jobs=3] [--max-old-space-size=8192]"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown flag: $arg${NC}"
      exit 1
      ;;
  esac
done

if ! [[ "$JOBS" =~ ^[0-9]+$ ]] || [ "$JOBS" -lt 1 ]; then
  echo -e "${RED}Invalid --jobs value: $JOBS (must be >= 1)${NC}"
  exit 1
fi

if [ -n "$MAX_OLD_SPACE_SIZE" ]; then
  export NODE_OPTIONS="--max-old-space-size=$MAX_OLD_SPACE_SIZE ${NODE_OPTIONS:-}"
elif [ "$SMART_MODE" = true ]; then
  export NODE_OPTIONS="--max-old-space-size=8192 ${NODE_OPTIONS:-}"
fi

STEP=1
TOTAL_STEPS=0

run_cross_repo_check() {
  echo "🔗 Step $STEP/$TOTAL_STEPS: Cross-repo compatibility check..."
  local TPV_PATH="../avoqado-tpv"

  if [ -d "$TPV_PATH" ]; then
    echo -e "${YELLOW}⚠️ RECORDATORIO: TPV Android tarda 3-5 días en actualizarse (firma PAX)${NC}"
    echo ""
    echo "   Verifica antes de deploy:"
    echo "   • ¿Esta feature del dashboard afecta config que usa el TPV?"
    echo "   • ¿El backend ya soporta los cambios necesarios?"
    echo ""

    local TPV_VERSION
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
}

run_git_status_check() {
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
  STEP=$((STEP + 1))
}

run_e2e_check() {
  echo "🎭 Step $STEP/$TOTAL_STEPS: Running Playwright E2E tests..."

  # Check if Playwright browsers are actually installed
  local PW_CACHE_MAC="$HOME/Library/Caches/ms-playwright"
  local PW_CACHE_LINUX="$HOME/.cache/ms-playwright"
  local PW_CACHE="${PLAYWRIGHT_BROWSERS_PATH:-${PW_CACHE_MAC}}"
  [ ! -d "$PW_CACHE" ] && PW_CACHE="${PW_CACHE_LINUX}"

  if [ ! -d "$PW_CACHE" ] || [ -z "$(ls -A "$PW_CACHE" 2>/dev/null)" ]; then
    echo -e "${YELLOW}   Browsers no encontrados. Instalando chromium...${NC}"
    npx playwright install chromium
  fi

  if npm run test:e2e; then
    echo -e "${GREEN}✅ E2E tests passed!${NC}"
  else
    echo -e "${RED}❌ E2E tests failed!${NC}"
    echo -e "${YELLOW}💡 Run 'npm run test:e2e:ui' to debug interactively${NC}"
    exit 1
  fi
  echo ""
  STEP=$((STEP + 1))
}

run_sequential_core() {
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

  echo "🔗 Step $STEP/$TOTAL_STEPS: Checking API endpoints..."
  if npm run check:endpoints; then
    echo -e "${GREEN}✅ Endpoint check passed!${NC}"
  else
    echo -e "${RED}❌ Endpoint check failed!${NC}"
    exit 1
  fi
  echo ""
  STEP=$((STEP + 1))

  echo "🏗️ Step $STEP/$TOTAL_STEPS: Building application..."
  if npm run build; then
    echo -e "${GREEN}✅ Build successful!${NC}"
  else
    echo -e "${RED}❌ Build failed!${NC}"
    exit 1
  fi
  echo ""
  STEP=$((STEP + 1))
}

run_smart_core() {
  echo "🧠 Step $STEP/$TOTAL_STEPS: Running intelligent core checks (worker pool)..."
  echo "   Auto-fixing lint issues before parallel checks..."
  npm run lint:fix 2>/dev/null || true

  local log_dir=".cache/pre-deploy-logs"
  if ! mkdir -p "$log_dir" 2>/dev/null; then
    log_dir="${TMPDIR:-/tmp}/avoqado-pre-deploy-logs"
    mkdir -p "$log_dir"
  fi
  SMART_LOG_DIR="$log_dir"

  local task_names=()
  local task_cmds=()
  task_names+=("ESLint")
  task_cmds+=("npm run lint -- --quiet")
  task_names+=("API endpoint check")
  task_cmds+=("npm run check:endpoints")
  task_names+=("Build application")
  task_cmds+=("npm run build")

  local task_count=${#task_names[@]}
  local effective_jobs="$JOBS"
  if [ "$effective_jobs" -gt "$task_count" ]; then
    effective_jobs="$task_count"
  fi
  echo "   Tasks: $task_count | Workers: $effective_jobs"

  local next_idx=0
  local running_pids=()
  local running_task_idx=()
  local task_logs=()
  local task_start=()

  while [ "$next_idx" -lt "$task_count" ] && [ "${#running_pids[@]}" -lt "$effective_jobs" ]; do
    local idx="$next_idx"
    next_idx=$((next_idx + 1))
    local log_file="$log_dir/task-$idx.log"
    task_logs[$idx]="$log_file"
    task_start[$idx]=$(date +%s)
    echo "   ▶️  ${task_names[$idx]}"
    (bash -lc "${task_cmds[$idx]}") >"$log_file" 2>&1 &
    running_pids+=("$!")
    running_task_idx+=("$idx")
  done

  while [ "${#running_pids[@]}" -gt 0 ]; do
    local i=0
    while [ "$i" -lt "${#running_pids[@]}" ]; do
      local pid="${running_pids[$i]}"
      local idx="${running_task_idx[$i]}"
      if kill -0 "$pid" 2>/dev/null; then
        i=$((i + 1))
        continue
      fi

      local elapsed=$(( $(date +%s) - ${task_start[$idx]} ))
      if wait "$pid"; then
        echo -e "${GREEN}   ✅ ${task_names[$idx]} (${elapsed}s)${NC}"
        local next_running_pids=()
        local next_running_task_idx=()
        local j=0
        while [ "$j" -lt "${#running_pids[@]}" ]; do
          if [ "$j" -ne "$i" ]; then
            next_running_pids+=("${running_pids[$j]}")
            next_running_task_idx+=("${running_task_idx[$j]}")
          fi
          j=$((j + 1))
        done
        running_pids=(${next_running_pids[@]+"${next_running_pids[@]}"})
        running_task_idx=(${next_running_task_idx[@]+"${next_running_task_idx[@]}"})

        if [ "$next_idx" -lt "$task_count" ]; then
          local nidx="$next_idx"
          next_idx=$((next_idx + 1))
          local nlog="$log_dir/task-$nidx.log"
          task_logs[$nidx]="$nlog"
          task_start[$nidx]=$(date +%s)
          echo "   ▶️  ${task_names[$nidx]}"
          (bash -lc "${task_cmds[$nidx]}") >"$nlog" 2>&1 &
          running_pids+=("$!")
          running_task_idx+=("$nidx")
        fi
        continue
      fi

      echo -e "${RED}   ❌ ${task_names[$idx]} failed (${elapsed}s)${NC}"
      echo "   📄 Showing logs from ${task_names[$idx]}:"
      cat "${task_logs[$idx]}"
      for other_pid in "${running_pids[@]}"; do
        [ "$other_pid" = "$pid" ] && continue
        kill "$other_pid" 2>/dev/null || true
      done
      for other_pid in "${running_pids[@]}"; do
        [ "$other_pid" = "$pid" ] && continue
        wait "$other_pid" 2>/dev/null || true
      done
      exit 1
    done
    sleep 0.2
  done

  echo -e "${GREEN}✅ Intelligent core checks passed!${NC}"
  echo ""
  STEP=$((STEP + 1))
}

cleanup_smart_logs() {
  if [ "$SMART_MODE" != true ] || [ -z "${SMART_LOG_DIR:-}" ]; then
    return
  fi

  rm -f "$SMART_LOG_DIR"/task-*.log 2>/dev/null || true
  rmdir "$SMART_LOG_DIR" 2>/dev/null || true
}

if [ "$SMART_MODE" = true ]; then
  TOTAL_STEPS=3 # smart core + cross-repo + git-status
else
  TOTAL_STEPS=5 # lint + endpoints + build + cross-repo + git-status
fi
[ "$SKIP_E2E" = false ] && TOTAL_STEPS=$((TOTAL_STEPS + 1))

echo "🚀 ============================================="
echo "🚀 PRE-DEPLOY VERIFICATION (Dashboard)"
echo "🚀 ============================================="
if [ "$SMART_MODE" = true ]; then
  echo -e "${YELLOW}🧠 Smart mode enabled (worker pool with $JOBS jobs)${NC}"
fi
if [ -n "$MAX_OLD_SPACE_SIZE" ]; then
  echo -e "${YELLOW}🧠 Node memory set to ${MAX_OLD_SPACE_SIZE}MB${NC}"
elif [ "$SMART_MODE" = true ]; then
  echo -e "${YELLOW}🧠 Node memory set to 8192MB (default smart mode)${NC}"
fi
echo ""

if [ "$SMART_MODE" = true ]; then
  run_smart_core
else
  run_sequential_core
fi

if [ "$SKIP_E2E" = true ]; then
  echo -e "${YELLOW}⏭️  Skipping E2E tests (--skip-e2e flag)${NC}"
  echo ""
else
  run_e2e_check
fi

run_cross_repo_check
run_git_status_check
cleanup_smart_logs

echo "🎉 ============================================="
echo "🎉 ALL CHECKS PASSED! READY FOR DEPLOY 🚀"
echo "🎉 ============================================="
echo ""
echo "Next steps:"
echo "  1. Commit your changes: git add . && git commit -m 'your message'"
echo "  2. Push to develop: git push origin develop (triggers demo + staging)"
echo "  3. Push to main: git push origin main (triggers production deploy)"
echo ""
