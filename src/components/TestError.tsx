/**
 * @pending-implementation
 * TestError Component - FOR TESTING ONLY
 *
 * This component intentionally throws an error to test ErrorBoundary.
 * DELETE THIS FILE after testing.
 *
 * Usage: Import and render <TestError /> anywhere to trigger ErrorBoundary
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function TestError() {
  const [shouldError, setShouldError] = useState(false)

  if (shouldError) {
    throw new Error('Test error thrown intentionally to verify ErrorBoundary')
  }

  return (
    <div className="p-4 border border-dashed border-destructive rounded-md">
      <p className="text-sm text-muted-foreground mb-2">
        Click to test ErrorBoundary (will crash the app intentionally)
      </p>
      <Button variant="destructive" onClick={() => setShouldError(true)}>
        Trigger Error
      </Button>
    </div>
  )
}
