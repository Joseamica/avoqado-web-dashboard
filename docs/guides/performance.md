# React Performance & Optimization

Complete guide to React performance optimization patterns, with emphasis on preventing render loops and memoization best practices.

## Critical Rule: Always Memoize Data Arrays

**⚠️ MOST IMPORTANT RULE**: Always memoize filtered/transformed arrays passed to `DataTable` or other list components.

### Why This Matters

React components re-render when:
1. Props change (new reference)
2. State changes
3. Parent component re-renders

Arrays created in render have **new references** every time, even if content is identical:

```typescript
// ❌ BAD - Creates new array reference on every render
function MyComponent() {
  const data = [1, 2, 3]  // ← NEW reference every render

  return <DataTable data={data} />
  // DataTable sees "data changed" → re-renders → parent re-renders → INFINITE LOOP
}
```

### The Correct Pattern

```typescript
// ✅ GOOD - Array reference only changes when dependencies change
function MyComponent() {
  const data = useMemo(() => [1, 2, 3], [])  // ← Stable reference

  return <DataTable data={data} />
  // DataTable only re-renders when data actually changes
}
```

## React Hooks for Performance

### useMemo

**Purpose**: Memoize expensive calculations and object/array references

**When to use:**
- ✅ Filtered/mapped/sorted arrays passed to components
- ✅ Objects passed as props
- ✅ Expensive computations (complex calculations, large data transformations)
- ✅ Column definitions for DataTable

**Syntax:**
```typescript
const memoizedValue = useMemo(() => {
  // Expensive calculation
  return someFunction(data)
}, [data])  // Dependency array: recalculate only when 'data' changes
```

**Examples:**

**Filtering arrays:**
```typescript
const filteredProducts = useMemo(
  () => products.filter(p => p.active),
  [products]
)
```

**Sorting arrays:**
```typescript
const sortedOrders = useMemo(
  () => orders.sort((a, b) => b.createdAt - a.createdAt),
  [orders]
)
```

**Mapping arrays:**
```typescript
const productNames = useMemo(
  () => products.map(p => p.name),
  [products]
)
```

**Complex transformations:**
```typescript
const chartData = useMemo(() => {
  return orders.reduce((acc, order) => {
    const date = formatDate(order.createdAt)
    acc[date] = (acc[date] || 0) + order.total
    return acc
  }, {})
}, [orders])
```

**Column definitions:**
```typescript
const columns = useMemo<ColumnDef<Product>[]>(() => [
  {
    accessorKey: 'name',
    header: t('columns.name'),
    cell: ({ cell }) => <span>{cell.getValue()}</span>,
  },
  {
    accessorKey: 'price',
    header: t('columns.price'),
    cell: ({ cell }) => Currency(cell.getValue() as number),
  },
], [t])  // Only recreate when translation function changes
```

### useCallback

**Purpose**: Memoize function references

**When to use:**
- ✅ Event handlers passed as props
- ✅ Search/filter handlers for DataTable
- ✅ Callbacks in dependency arrays
- ✅ Functions passed to child components

**Syntax:**
```typescript
const memoizedCallback = useCallback(() => {
  // Function logic
  doSomething(a, b)
}, [a, b])  // Dependency array: recreate only when a or b changes
```

**Examples:**

**Search handlers:**
```typescript
const handleSearch = useCallback((searchTerm: string, data: Product[]) => {
  if (!searchTerm) return data

  return data.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  )
}, [])  // No dependencies - search logic is static
```

**Event handlers with dependencies:**
```typescript
const handleEdit = useCallback((productId: string) => {
  navigate(`/venues/${venueSlug}/products/${productId}`)
}, [navigate, venueSlug])  // Recreate when these change
```

**Form submission:**
```typescript
const handleSubmit = useCallback((data: ProductInput) => {
  createMutation.mutate(data)
}, [createMutation])
```

### useEffect

**Purpose**: Synchronize with external systems (API calls, subscriptions, DOM manipulation)

**⚠️ WARNING**: Common source of infinite loops! Be careful with dependencies.

**When to use:**
- ✅ Fetching data based on prop/state changes
- ✅ Setting up subscriptions (WebSocket, intervals)
- ✅ Updating document title
- ✅ Analytics tracking

**Syntax:**
```typescript
useEffect(() => {
  // Side effect logic

  return () => {
    // Cleanup logic
  }
}, [dependencies])
```

**Examples:**

**Fetch data when ID changes:**
```typescript
useEffect(() => {
  fetchProduct(productId)
}, [productId])
```

**WebSocket subscription:**
```typescript
useEffect(() => {
  const socket = io(SOCKET_URL)

  socket.on('order:created', handleNewOrder)

  return () => {
    socket.off('order:created', handleNewOrder)
    socket.disconnect()
  }
}, [handleNewOrder])
```

**Update document title:**
```typescript
useEffect(() => {
  document.title = `${venue.name} - Dashboard`
}, [venue.name])
```

## Common Performance Pitfalls

### Pitfall #1: Unmemoized Array Transformations

**❌ WRONG:**
```typescript
function ProductsPage() {
  const { data } = useQuery(...)

  // Creates new array every render!
  const filteredData = data?.filter(p => p.active) || []

  return <DataTable data={filteredData} />
  // DataTable re-renders infinitely
}
```

**✅ CORRECT:**
```typescript
function ProductsPage() {
  const { data } = useQuery(...)

  const filteredData = useMemo(
    () => data?.filter(p => p.active) || [],
    [data]
  )

  return <DataTable data={filteredData} />
}
```

### Pitfall #2: Unmemoized Search Handlers

**❌ WRONG:**
```typescript
function ProductsPage() {
  const handleSearch = (searchTerm: string, data: Product[]) => {
    return data.filter(p => p.name.includes(searchTerm))
  }

  return <DataTable data={data} onSearch={handleSearch} />
  // handleSearch is new function every render → DataTable re-renders
}
```

**✅ CORRECT:**
```typescript
function ProductsPage() {
  const handleSearch = useCallback((searchTerm: string, data: Product[]) => {
    return data.filter(p => p.name.includes(searchTerm))
  }, [])  // Stable function reference

  return <DataTable data={data} onSearch={handleSearch} />
}
```

### Pitfall #3: Objects in Dependency Arrays

**❌ WRONG:**
```typescript
function MyComponent({ user }) {
  useEffect(() => {
    fetchUserData(user)
  }, [user])  // 'user' is object → new reference every render → infinite loop
}
```

**✅ CORRECT:**
```typescript
function MyComponent({ user }) {
  useEffect(() => {
    fetchUserData(user)
  }, [user.id])  // Depend on primitive value, not object
}
```

### Pitfall #4: Function Dependencies

**❌ WRONG:**
```typescript
function MyComponent() {
  const fetchData = () => {
    api.get('/data')  // New function every render
  }

  useEffect(() => {
    fetchData()
  }, [fetchData])  // fetchData changes every render → infinite loop
}
```

**✅ CORRECT:**
```typescript
function MyComponent() {
  const fetchData = useCallback(() => {
    api.get('/data')
  }, [])  // Stable function reference

  useEffect(() => {
    fetchData()
  }, [fetchData])
}
```

### Pitfall #5: Inline Function Props

**❌ WRONG:**
```typescript
function ParentComponent() {
  return (
    <ChildComponent
      onClick={() => console.log('clicked')}  // New function every render
    />
  )
}
```

**✅ CORRECT:**
```typescript
function ParentComponent() {
  const handleClick = useCallback(() => {
    console.log('clicked')
  }, [])

  return <ChildComponent onClick={handleClick} />
}
```

## Real-World Case Study: Teams.tsx Freeze Bug

### The Problem

The Teams.tsx page froze when searching or clicking "Invitar Miembro" (Invite Member), but **ONLY for OWNER role**. SUPERADMIN worked fine.

### Root Cause

```typescript
// ❌ BAD - Not memoized
const filteredTeamMembers = filterSuperadminFromTeam(
  teamData?.data || [],
  staffInfo?.role
)
```

The `filterSuperadminFromTeam()` utility has **asymmetric behavior**:

```typescript
export const filterSuperadminFromTeam = (teamMembers: any[], userRole?: StaffRole) => {
  // Fast path for SUPERADMIN
  if (canViewSuperadminInfo(userRole)) {
    return teamMembers  // ✅ Same reference
  }

  // Slow path for OWNER and other roles
  return teamMembers.filter(member => member.role !== StaffRole.SUPERADMIN)
  // ❌ NEW array reference every render!
}
```

### The Render Loop

```
1. Component renders
   └─ filteredTeamMembers gets NEW array (for OWNER)
2. DataTable receives "new data" → re-renders
3. Dialog opens → triggers parent re-render
4. Back to step 1 → INFINITE LOOP
5. CPU 100% → Page freeze
```

### The Fix

```typescript
// ✅ GOOD - Memoized
const filteredTeamMembers = useMemo(
  () => filterSuperadminFromTeam(teamData?.data || [], staffInfo?.role),
  [teamData?.data, staffInfo?.role]
)

const filteredInvitations = useMemo(
  () => filterSuperadminFromTeam(invitationData?.data || [], staffInfo?.role),
  [invitationData?.data, staffInfo?.role]
)
```

**Result**: Array only recreated when data or role actually changes. No more infinite loop!

### Secondary Optimization

The `staffInfo` object in AuthContext was also being recreated every render:

```typescript
// ❌ BAD - New object every render
const value: AuthContextType = {
  // ...
  staffInfo: { ...user, role: userRole },  // New object reference
}
```

**Fix:**
```typescript
// ✅ GOOD - Memoized before early return
const staffInfo = useMemo(
  () => (user ? { ...user, role: userRole } : null),
  [user, userRole]
)

// ... early return for loading

const value: AuthContextType = {
  // ...
  staffInfo,  // Stable reference
}
```

### Lessons Learned

1. **Always memoize filtered arrays** - Even if filtering logic seems fast
2. **Watch out for asymmetric functions** - Functions that sometimes return same reference, sometimes new
3. **Memoize context values** - Especially objects and arrays
4. **Test with different roles** - Bugs may only affect specific roles
5. **Use React DevTools Profiler** - Identify components re-rendering excessively

## Debugging Render Loops

### Symptoms

- Page freezes
- CPU usage 100%
- Browser tab becomes unresponsive
- Console shows thousands of logs in seconds
- React DevTools Profiler shows excessive re-renders

### Debugging Steps

**1. Add console.log to identify render frequency:**
```typescript
function MyComponent() {
  console.log('MyComponent rendered')
  // ...
}
```

**2. Check dependency arrays:**
```typescript
useEffect(() => {
  console.log('Effect running')
}, [dependency])  // ← What is dependency? Is it changing every render?
```

**3. Use React DevTools Profiler:**
- Open React DevTools
- Go to "Profiler" tab
- Click "Record"
- Interact with page
- Stop recording
- Review flame graph to identify hot components

**4. Add debugging to memoization:**
```typescript
const filteredData = useMemo(() => {
  console.log('Recalculating filteredData')
  return data.filter(...)
}, [data])
// If you see this log constantly, 'data' is changing every render
```

**5. Check object identity:**
```typescript
const previousData = useRef()

useEffect(() => {
  console.log('Data changed?', previousData.current !== data)
  console.log('Old:', previousData.current)
  console.log('New:', data)
  previousData.current = data
}, [data])
```

### Quick Fixes

**Immediate stop-gap** (while debugging):
```typescript
// Add debounce to search
const debouncedSearch = useMemo(
  () => debounce(handleSearch, 300),
  [handleSearch]
)
```

**Long-term fix**: Add proper memoization as shown in this guide.

## Performance Checklist

Before deploying a component with DataTable or large lists:

- [ ] ✅ Data arrays wrapped in `useMemo`
- [ ] ✅ Column definitions wrapped in `useMemo`
- [ ] ✅ Search handlers wrapped in `useCallback`
- [ ] ✅ Event handlers wrapped in `useCallback`
- [ ] ✅ No objects/arrays in useEffect dependencies (use primitives)
- [ ] ✅ No inline function props
- [ ] ✅ Context values memoized (if objects/arrays)
- [ ] ✅ Tested with different roles
- [ ] ✅ Tested with large datasets (100+ items)
- [ ] ✅ No console warnings about missing dependencies

## When NOT to Memoize

Memoization has overhead. Don't memoize when:

- ❌ Component renders once and never updates
- ❌ Calculation is trivial (simple arithmetic, string concatenation)
- ❌ Dependency array would include every prop/state (defeats purpose)
- ❌ Function is only used once and not passed as prop

**Example of over-optimization:**
```typescript
// ❌ Unnecessary - simple calculation
const total = useMemo(() => price + tax, [price, tax])

// ✅ Just calculate directly
const total = price + tax
```

## Related Documentation

- [Render Loops Troubleshooting](../troubleshooting/render-loops.md) - Detailed debugging guide
- [Architecture Overview](../architecture/overview.md) - Component patterns
- [DataTable Component](./data-table.md) - DataTable-specific optimization
