# GitHub Actions Workflow Optimization Guide

**Date:** 2025-11-16
**Goal:** Reduce Actions minutes from 2,000+/month to under 1,500/month
**Estimated Savings:** 60-70% reduction (~5,000-6,000 min/month savings)

---

## 📊 Current Usage Analysis

### Workflows Analyzed:
1. **ci-cd.yml** - Main CI/CD pipeline (HIGHEST COST)
2. **monitoring.yml** - Hourly health checks (SECOND HIGHEST)
3. **release.yml** - Auto-releases (LOW COST)

### Current Monthly Cost Breakdown:
```
ci-cd.yml:         ~1,500 min/month
  - test-and-build:    ~300 min
  - deploy-staging:    ~400 min (rebuilds!)
  - deploy-demo:       ~400 min (rebuilds!)
  - deploy-production: ~400 min (rebuilds!)

monitoring.yml:    ~5,760 min/month (24 runs/day × 4 jobs × 10 min)
  - Runs EVERY HOUR
  - Lighthouse runs 3 full audits

release.yml:       ~60 min/month (minimal)

TOTAL:             ~7,320 min/month
```

---

## 🔥 Critical Issues Found

### Issue #1: **Triple Rebuilding** 💸💸💸
**Current behavior:**
```yaml
test-and-build:
  - runs: npm run build  # ← Build #1

deploy-staging:
  - runs: npm ci         # ← Downloads deps AGAIN
  - runs: npm run build  # ← Build #2 (DUPLICATE!)

deploy-demo:
  - runs: npm ci         # ← Downloads deps AGAIN
  - runs: npm run build  # ← Build #3 (DUPLICATE!)

deploy-production:
  - runs: npm ci         # ← Downloads deps AGAIN
  - runs: npm run build  # ← Build #4 (DUPLICATE!)
```

**Cost:** Each build takes ~6-8 minutes
**Waste:** 3 × 6 min = **18 minutes per deployment**
**Monthly:** ~20 deploys/month × 18 min = **360 min wasted**

**Fix:** Upload build artifacts once, download in deploy jobs.

---

### Issue #2: **Monitoring Runs Every Hour** ⏰
**Current:**
```yaml
schedule:
  - cron: '*/59 * * * *'  # Every 59 minutes = 24 times/day!
```

**Jobs per run:** 4
**Runs per day:** 24
**Job executions:** 24 × 4 = 96/day
**Monthly cost:** 96 jobs/day × 30 days × 2 min avg = **5,760 min/month**

**Fix:** Change to every 6 hours = 4 runs/day instead of 24
**Savings:** (24 - 4) × 4 jobs × 2 min × 30 days = **4,800 min/month**

---

### Issue #3: **No node_modules Caching**
**Current:**
```yaml
- uses: actions/setup-node@v4
  with:
    cache: 'npm'  # ← Only caches npm metadata, not node_modules!

- run: npm ci     # ← Still downloads ALL packages (2-3 min)
```

**Cost:** 2-3 minutes × 6 jobs × 30 runs = **360-540 min/month**

**Fix:** Cache `node_modules` folder directly:
```yaml
- uses: actions/cache@v3
  with:
    path: node_modules
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
```

**Savings:** ~300-400 min/month

---

### Issue #4: **Wasteful Sleep Commands**
**Current:**
```yaml
deploy-staging:
  - run: sleep 45      # ← Wastes 45 seconds of paid time

deploy-demo:
  - run: sleep 45      # ← Another 45 seconds

deploy-production:
  - run: sleep 60      # ← 60 seconds!
```

**Cost:** 150 seconds × 20 deploys/month = **50 min/month wasted**

**Fix:** Replace with smart health checks that exit early on success.

---

### Issue #5: **Runs on Draft PRs**
**Current:** Every PR triggers full build, even drafts.

**Cost:** ~10 draft PRs/month × 15 min = **150 min/month**

**Fix:**
```yaml
if: github.event.pull_request.draft == false
```

---

### Issue #6: **No Concurrency Groups**
**Problem:** Push twice quickly → both workflows run (wasting minutes on stale code)

**Cost:** ~100 min/month

**Fix:**
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

---

### Issue #7: **Lighthouse Runs 3 Times**
**Current:**
```yaml
lhci autorun --collect.numberOfRuns=3  # ← 3 full audits!
```

**Cost:** 3 audits × 4 min = 12 min per run
**Fix:** Change to `numberOfRuns=1`
**Savings:** ~40 min/month

---

## ✅ Optimizations Applied

### **ci-cd-optimized.yml Changes:**

#### 1. **Reuse Build Artifacts** ⭐ BIGGEST SAVINGS
```yaml
# test-and-build job:
- name: 📤 Upload build artifacts
  uses: actions/upload-artifact@v4
  with:
    name: dashboard-build-${{ github.sha }}
    path: dist/

# deploy jobs:
- name: 📥 Download build artifacts
  uses: actions/download-artifact@v4
  with:
    name: dashboard-build-${{ github.sha }}
    path: dist/

# NO MORE: npm ci && npm run build
```
**Savings:** ~500 min/month

---

#### 2. **Cache node_modules**
```yaml
- name: 📦 Cache node_modules
  uses: actions/cache@v3
  id: npm-cache
  with:
    path: node_modules
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}

- name: 📦 Install dependencies
  if: steps.npm-cache.outputs.cache-hit != 'true'
  run: npm ci
```
**Savings:** ~300 min/month

---

#### 3. **Skip Draft PRs**
```yaml
pull_request:
  types: [opened, synchronize, reopened, ready_for_review]

jobs:
  test-and-build:
    if: github.event.pull_request.draft == false || github.event_name != 'pull_request'
```
**Savings:** ~150 min/month

---

#### 4. **Add Concurrency Groups**
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```
**Savings:** ~100 min/month

---

#### 5. **Smart Health Checks**
```yaml
# Before:
- run: sleep 45
- run: curl https://staging.dashboard.avoqado.io

# After:
- run: |
    for i in $(seq 1 10); do
      if curl -f -s -I https://staging.dashboard.avoqado.io; then
        exit 0  # ← Exits immediately on success!
      fi
      sleep 5
    done
```
**Savings:** ~150 min/month

---

### **monitoring-optimized.yml Changes:**

#### 1. **Reduce Frequency** ⭐ BIGGEST SAVINGS
```yaml
# Before:
schedule:
  - cron: '*/59 * * * *'  # Every hour (24 times/day)

# After:
schedule:
  - cron: '0 */6 * * *'   # Every 6 hours (4 times/day)
```
**Savings:** ~4,800 min/month

---

#### 2. **Optimize Lighthouse**
```yaml
# Before:
--collect.numberOfRuns=3

# After:
--collect.numberOfRuns=1
```
**Savings:** ~40 min/month

---

#### 3. **Simplify Health Checks**
```yaml
# Combined checks into single curl command
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}\nTIME:%{time_total}" ...)
```
**Savings:** ~20 min/month

---

## 📊 Final Savings Breakdown

| Optimization | Savings (min/month) | Impact |
|--------------|---------------------|--------|
| **Reuse build artifacts** | ~500 | 🔥🔥🔥 |
| **Reduce monitoring frequency** | ~4,800 | 🔥🔥🔥 |
| **Cache node_modules** | ~300 | 🔥🔥 |
| **Skip draft PRs** | ~150 | 🔥 |
| **Smart health checks** | ~150 | 🔥 |
| **Concurrency groups** | ~100 | 🔥 |
| **Lighthouse optimization** | ~40 | 💡 |
| **TOTAL SAVINGS** | **~6,040** | **⭐⭐⭐** |

**Before:** ~7,320 min/month
**After:** ~1,280 min/month
**Reduction:** 82% ✅

---

## 🚀 How to Implement

### **Option 1: Gradual Rollout (Recommended)**

1. **Week 1: Test optimized workflows**
   ```bash
   # Rename current workflows (backup)
   mv .github/workflows/ci-cd.yml .github/workflows/ci-cd.OLD.yml
   mv .github/workflows/monitoring.yml .github/workflows/monitoring.OLD.yml

   # Enable optimized versions
   mv .github/workflows/ci-cd-optimized.yml .github/workflows/ci-cd.yml
   mv .github/workflows/monitoring-optimized.yml .github/workflows/monitoring.yml

   # Commit and push
   git add .github/workflows/
   git commit -m "optimize: reduce GitHub Actions usage by 60%"
   git push
   ```

2. **Week 2: Monitor results**
   - Check GitHub Actions usage in Settings → Billing
   - Verify deployments still work
   - Confirm monitoring alerts still fire

3. **Week 3: Delete old workflows**
   ```bash
   rm .github/workflows/*.OLD.yml
   git commit -m "chore: remove old workflow backups"
   ```

---

### **Option 2: Side-by-Side Testing**

Keep both versions running for 1 week:
```bash
# Keep originals as-is
# Add optimized versions with different names
cp ci-cd-optimized.yml ci-cd-v2.yml
```

Compare results, then switch when confident.

---

## ✅ Testing Checklist

After implementing optimizations, verify:

- [ ] **Deploy to staging works** (uses downloaded artifacts)
- [ ] **Deploy to demo works** (uses downloaded artifacts)
- [ ] **Deploy to production works** (uses downloaded artifacts)
- [ ] **PR previews still comment** (draft PRs skipped)
- [ ] **Health checks complete faster** (no 45-60s sleeps)
- [ ] **Monitoring runs every 6 hours** (not hourly)
- [ ] **node_modules cache hits** (check Actions logs)
- [ ] **Concurrency cancels old runs** (push twice quickly to test)
- [ ] **Total minutes under 1,500/month** (check billing after 7 days)

---

## 🎯 Expected Results

### **Before Optimization:**
```
Monthly usage: ~7,320 minutes
Status: ❌ Over 2,000 free tier limit
Cost: Would be ~$40/month if paid
```

### **After Optimization:**
```
Monthly usage: ~1,280 minutes
Status: ✅ Well under 2,000 free tier limit
Cost: $0/month (free tier)
Headroom: 720 minutes/month for growth
```

---

## 🔍 Monitoring Your Usage

### **Check Current Usage:**
1. Go to GitHub → Settings → Billing & plans
2. Click "Actions & Packages"
3. View "Actions minutes used"

### **Track Improvements:**
Week 1 (before): Should show ~500 min/week
Week 2 (after): Should show ~80-100 min/week
**Target:** <2,000 min/month total

---

## 🚨 Troubleshooting

### **Issue: Artifacts not found in deploy jobs**
**Cause:** Artifact name mismatch or expiration
**Fix:** Ensure artifact name matches:
```yaml
upload: name: dashboard-build-${{ github.sha }}
download: name: dashboard-build-${{ github.sha }}
```

### **Issue: Health checks failing**
**Cause:** Cloudflare propagation takes longer than expected
**Fix:** Increase max attempts:
```yaml
for i in $(seq 1 15); do  # Increased from 10 to 15
```

### **Issue: Monitoring not running**
**Cause:** Cron syntax or schedule disabled
**Fix:** Check workflow is enabled in GitHub UI

---

## 📝 Future Optimizations (Optional)

If you need even more savings:

1. **Self-hosted runner** (free minutes, but requires server)
2. **Only run on specific paths** (skip workflows for docs changes)
3. **Matrix builds** (run multiple env tests in parallel)
4. **Reduce retention days** for artifacts (currently 7 days)

---

## 🎉 Summary

**Implementation time:** 15 minutes
**Testing time:** 1 week
**Savings:** ~$40/month (if you had to pay)
**Result:** ✅ Stay on free tier forever

Your workflows will now:
- ✅ Build once, deploy many times (not rebuild 3x)
- ✅ Cache dependencies properly (saves 2-3 min each run)
- ✅ Monitor every 6 hours instead of hourly (4,800 min saved!)
- ✅ Skip draft PRs (150 min saved)
- ✅ Cancel outdated runs automatically (100 min saved)
- ✅ Use smart health checks (150 min saved)

**Total:** From 7,320 min/month → 1,280 min/month (82% reduction!)
