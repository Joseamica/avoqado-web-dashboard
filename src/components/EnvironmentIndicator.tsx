export function EnvironmentIndicator() {
  const hostname = window.location.hostname
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.endsWith('.local')
  const isStaging = hostname.includes('staging')
  
  if (!isLocal && !isStaging) return null

  if (isLocal) {
    return (
      <div className="relative w-full bg-blue-600 text-foreground text-center py-1 text-sm font-medium shadow-md">
        🛠️ DEVELOPMENT ENVIRONMENT - Local development
      </div>
    )
  }

  return (
    <div className="relative w-full bg-orange-500 text-foreground text-center py-1 text-sm font-medium shadow-md">
      🧪 STAGING ENVIRONMENT - Test data only
    </div>
  )
}