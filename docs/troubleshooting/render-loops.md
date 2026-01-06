# Debugging Render Loops

Comprehensive troubleshooting guide for identifying and fixing infinite render loops in React.

## What is a Render Loop?

An **infinite render loop** occurs when a component continuously re-renders itself, causing:
- Page freeze
- Browser tab unresponsiveness
- CPU usage at 100%
- Memory leak
- Browser crash

### How It Happens

```
Component renders
  └─ State/props change
     └─ Component re-renders
        └─ State/props change (again!)
           └─ Component re-renders (again!)
              └─ INFINITE LOOP
```

## Symptoms

### User Experience
- ✅ Page freezes immediately or after interaction (click, search, etc.)
- ✅ Browser tab shows "(Not Responding)"
- ✅ CPU usage jumps to 100%
- ✅ Fans spin up on laptop
- ✅ Browser prompts to "Stop" or "Wait" for page

### Developer Console
- ✅ Console flooded with thousands of logs in seconds
- ✅ React warning: "Maximum update depth exceeded"
- ✅ Browser warning: "A script on this page may be causing your browser to run slowly"

### React DevTools
- ✅ Profiler shows component rendering hundreds of times per second
- ✅ Flame graph shows single component dominating render time
- ✅ Components tab shows constantly updating state values

## Common Causes

### 1. Unmemoized Arrays/Objects in Props

**The Problem:**
Arrays and objects created in render have new references every time, even if content is identical.

**Example:**
```typescript
// ❌ BAD - Creates new array every render
function ParentComponent() {
  const data = [1, 2, 3]  // ← NEW reference

  return <ChildComponent data={data} />
  // Child sees "data changed" → re-renders
  // Parent re-renders for some reason → creates new data array
  // Child sees "data changed" again → LOOP
}
```

**Fix:**
```typescript
// ✅ GOOD - Stable array reference
function ParentComponent() {
  const data = useMemo(() => [1, 2, 3], [])

  return <ChildComponent data={data} />
}
```

### 2. Unmemoized Callback Props

**The Problem:**
Functions defined in render are new instances every time.

**Example:**
```typescript
// ❌ BAD - Creates new function every render
function ParentComponent() {
  const handleClick = () => {
    console.log('clicked')
  }

  return <ChildComponent onClick={handleClick} />
  // Child sees "onClick changed" → re-renders
  // Triggers parent re-render → creates new handleClick
  // LOOP
}
```

**Fix:**
```typescript
// ✅ GOOD - Stable function reference
function ParentComponent() {
  const handleClick = useCallback(() => {
    console.log('clicked')
  }, [])

  return <ChildComponent onClick={handleClick} />
}
```

### 3. setState in Render

**The Problem:**
Calling state setters during render causes immediate re-render.

**Example:**
```typescript
// ❌ BAD - setState in render body
function MyComponent() {
  const [count, setCount] = useState(0)

  setCount(count + 1)  // ← IMMEDIATELY triggers re-render
  // Component re-renders → calls setCount again → LOOP

  return <div>{count}</div>
}
```

**Fix:**
```typescript
// ✅ GOOD - setState in event handler or useEffect
function MyComponent() {
  const [count, setCount] = useState(0)

  const handleClick = () => {
    setCount(count + 1)
  }

  return <button onClick={handleClick}>{count}</button>
}
```

### 4. useEffect with Missing/Wrong Dependencies

**The Problem:**
useEffect triggers on every render if dependencies are unstable.

**Example:**
```typescript
// ❌ BAD - Object dependency changes every render
function MyComponent({ user }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    fetchData(user.id).then(setData)
  }, [user])  // 'user' object changes every render → fetch every render → setData → re-render → LOOP
}
```

**Fix:**
```typescript
// ✅ GOOD - Primitive dependency
function MyComponent({ user }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    fetchData(user.id).then(setData)
  }, [user.id])  // Only fetch when user.id actually changes
}
```

### 5. Context Value Not Memoized

**The Problem:**
Context provider value created inline changes every render.

**Example:**
```typescript
// ❌ BAD - New object every render
function MyProvider({ children }) {
  const [state, setState] = useState({})

  return (
    <MyContext.Provider value={{ state, setState }}>
      {children}
    </MyContext.Provider>
  )
  // value object changes every render → all consumers re-render → provider re-renders → LOOP
}
```

**Fix:**
```typescript
// ✅ GOOD - Memoized value
function MyProvider({ children }) {
  const [state, setState] = useState({})

  const value = useMemo(() => ({ state, setState }), [state])

  return (
    <MyContext.Provider value={value}>
      {children}
    </MyContext.Provider>
  )
}
```

## Real Case Study: Teams.tsx OWNER Role Freeze

### The Bug Report

**User Report**: "When I search or click 'Invitar Miembro' (Invite Member) in Teams.tsx, the page freezes completely."

**Critical Insight**: Bug only affected OWNER role, NOT SUPERADMIN.

### Initial Investigation

**Attempt #1: Memoize column definitions**
```typescript
// Added useMemo to columns with mutation dependencies
const teamColumns = useMemo(() => [...], [deleteMutation, updateMutation])
```
**Result**: ❌ Still freezing

**Attempt #2: Remove mutation dependencies**
```typescript
// Removed mutations from dependencies
const teamColumns = useMemo(() => [...], [t])
```
**Result**: ❌ Still freezing

**User feedback**: "sigue congelandose :(" (still freezing)

### Deep Analysis

Used Task/Explore agent for ultra-deep code analysis. Found the real cause:

**Lines 130-131 in Teams.tsx:**
```typescript
// ❌ NOT MEMOIZED
const filteredTeamMembers = filterSuperadminFromTeam(teamData?.data || [], staffInfo?.role)
const filteredInvitations = filterSuperadminFromTeam(invitationData?.data || [], staffInfo?.role)
```

### Root Cause

The `filterSuperadminFromTeam()` utility has **asymmetric behavior**:

**File**: `src/utils/role-permissions.ts`
```typescript
export const filterSuperadminFromTeam = (teamMembers: any[], userRole?: StaffRole) => {
  // FAST PATH: SUPERADMIN sees everyone
  if (canViewSuperadminInfo(userRole)) {
    return teamMembers  // ✅ SAME reference (no new array)
  }

  // SLOW PATH: OWNER and other roles don't see SUPERADMIN users
  return teamMembers.filter(member => member.role !== StaffRole.SUPERADMIN)
  // ❌ NEW array reference EVERY TIME
}
```

**Why SUPERADMIN worked but OWNER didn't:**
- **SUPERADMIN**: Function returns same array reference → DataTable doesn't re-render
- **OWNER**: Function creates new array every render → DataTable sees "data changed" → re-renders → parent re-renders → new array → LOOP

### The Render Loop Flow

```
1. Teams.tsx renders
   └─ filteredTeamMembers = filterSuperadminFromTeam(...) [NEW ARRAY for OWNER]
      └─ DataTable receives filteredTeamMembers
         └─ DataTable detects "data changed" (new reference)
            └─ DataTable re-renders
               └─ Something triggers parent re-render (dialog opening, search input)
                  └─ Back to step 1 → INFINITE LOOP

Result: CPU 100% → Page freeze
```

### The Fix

**Applied in Teams.tsx (lines 132-140):**
```typescript
// ✅ MEMOIZED - Only recreates when data/role actually changes
const filteredTeamMembers = useMemo(
  () => filterSuperadminFromTeam(teamData?.data || [], staffInfo?.role),
  [teamData?.data, staffInfo?.role]
)

const filteredInvitations = useMemo(
  () => filterSuperadminFromTeam(invitationData?.data || [], staffInfo?.role),
  [invitationData?.data, staffInfo?.role]
)
```

**Result**: ✅ Bug fixed! No more freezing for any role.

### Secondary Fix: AuthContext staffInfo

During investigation, discovered `staffInfo` was also being recreated every render:

**File**: `src/context/AuthContext.tsx` (line 353)
```typescript
// ❌ BAD - New object every render
const value: AuthContextType = {
  // ...
  staffInfo: { ...user, role: userRole },  // ← NEW object reference
}
```

**Fix (lines 315-318):**
```typescript
// ✅ GOOD - Memoized BEFORE early return
const staffInfo = useMemo(
  () => (user ? { ...user, role: userRole } : null),
  [user, userRole]
)

// ... early return for loading

const value: AuthContextType = {
  // ...
  staffInfo,  // ← Stable reference
}
```

**Why before early return?**
React Hooks rule: All hooks must be called in the same order every render. Putting `useMemo` after an early return violates this rule.

## Debugging Workflow

### Step 1: Identify the Component

**Add logging to suspect components:**
```typescript
function SuspectComponent() {
  console.log('SuspectComponent rendered')
  // ...
}
```

**Look for:**
- Component logging thousands of times
- Logs appearing faster than you can read

### Step 2: Check Props and State

**Log props on every render:**
```typescript
function SuspectComponent({ data, onSearch }) {
  console.log('Props:', { data, onSearch })
  // ...
}
```

**Look for:**
- Objects/arrays that look identical but different references
- Props changing on every render

### Step 3: Use React DevTools Profiler

**Process:**
1. Open React DevTools
2. Go to "Profiler" tab
3. Click record button
4. Trigger the bug (click, search, etc.)
5. Stop recording immediately (before crash)
6. Review flame graph

**Look for:**
- Component with hundreds of renders in seconds
- Component taking up most of the flame graph
- Same component rendering repeatedly in timeline

### Step 4: Track Down the Cause

**Add useMemo debugging:**
```typescript
const filteredData = useMemo(() => {
  console.log('Recalculating filteredData')
  return data.filter(...)
}, [data])
```

**If you see constant logs:** The dependency (`data`) is changing every render.

**Track dependency changes:**
```typescript
const previousData = useRef()

useEffect(() => {
  if (previousData.current !== data) {
    console.log('Data reference changed!')
    console.log('Old:', previousData.current)
    console.log('New:', data)
  }
  previousData.current = data
}, [data])
```

### Step 5: Apply the Fix

**Common fixes:**
1. Wrap array/object in `useMemo`
2. Wrap function in `useCallback`
3. Change dependency from object to primitive (e.g., `user.id` instead of `user`)
4. Move setState out of render body into event handler/useEffect
5. Memoize context provider value

### Step 6: Verify

**Test thoroughly:**
- ✅ Page doesn't freeze
- ✅ Functionality still works
- ✅ No React warnings in console
- ✅ React DevTools Profiler shows normal render count
- ✅ Test with different roles/data sizes

## Prevention Checklist

Before deploying code with DataTable or large lists:

- [ ] ✅ All filtered/transformed arrays wrapped in `useMemo`
- [ ] ✅ All column definitions wrapped in `useMemo`
- [ ] ✅ All search/filter handlers wrapped in `useCallback`
- [ ] ✅ No objects/arrays in useEffect dependencies (use primitives)
- [ ] ✅ No inline function props
- [ ] ✅ Context values memoized (if objects/arrays)
- [ ] ✅ No setState calls in render body
- [ ] ✅ All useMemo/useCallback dependencies correct
- [ ] ✅ Tested with different user roles
- [ ] ✅ Tested with large datasets (100+ items)
- [ ] ✅ Profiled with React DevTools

## Quick Fixes (Emergency)

If production is down and you need a quick fix:

**1. Add debounce to search:**
```typescript
import { debounce } from 'lodash'

const debouncedSearch = useMemo(
  () => debounce(handleSearch, 300),
  [handleSearch]
)
```

**2. Limit render frequency:**
```typescript
const [renderCount, setRenderCount] = useState(0)

useEffect(() => {
  if (renderCount > 50) {
    console.error('Too many renders, stopping')
    return
  }
  setRenderCount(c => c + 1)
}, [])
```

**3. Add loading state:**
```typescript
const [isProcessing, setIsProcessing] = useState(false)

const handleAction = () => {
  if (isProcessing) return  // Prevent rapid clicks
  setIsProcessing(true)
  // ... action
  setIsProcessing(false)
}
```

**⚠️ These are TEMPORARY fixes!** Find and fix the root cause ASAP.

## Tools

### Browser DevTools

**Performance Tab:**
1. Open DevTools → Performance
2. Click Record
3. Trigger bug
4. Stop recording
5. Look for long tasks and excessive scripting time

**Memory Tab:**
1. Take heap snapshot before bug
2. Trigger bug
3. Take heap snapshot after
4. Compare snapshots - look for memory leak

### React DevTools

**Components Tab:**
- Click "Highlight updates" checkbox
- Watch which components flash on every render
- Rapidly flashing = probably the culprit

**Profiler Tab:**
- Record interaction
- Review "Ranked" view to see most expensive components
- Review "Flamegraph" to see render cascade

### console.trace()

**Find what's triggering renders:**
```typescript
function SuspectComponent() {
  console.trace('SuspectComponent rendered')
  // Shows call stack leading to this render
}
```

### React.StrictMode

**Helps catch issues in development:**
```typescript
// index.tsx
import { StrictMode } from 'react'

<StrictMode>
  <App />
</StrictMode>
```

StrictMode intentionally double-renders to catch side effects. If you see 2x renders in dev but not production, this is expected.

## Related Documentation

- [Performance Guide](../guides/performance.md) - React optimization patterns
- [Architecture Overview](../architecture/overview.md) - Component patterns
- [DataTable Component](../guides/data-table.md) - DataTable-specific optimization

## Additional Resources

- React Docs: [Optimizing Performance](https://react.dev/learn/render-and-commit)
- React Docs: [useMemo](https://react.dev/reference/react/useMemo)
- React Docs: [useCallback](https://react.dev/reference/react/useCallback)
- Kent C. Dodds: [When to useMemo and useCallback](https://kentcdodds.com/blog/usememo-and-usecallback)
