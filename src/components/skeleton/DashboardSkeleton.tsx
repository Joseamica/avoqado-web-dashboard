import { Card, CardContent, CardHeader } from '@/components/ui/card'

// Skeleton components for progressive loading

export const MetricCardSkeleton = () => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <div className="h-4 w-24 bg-muted rounded animate-pulse"></div>
      <div className="h-4 w-4 bg-muted rounded animate-pulse"></div>
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        <div className="h-8 w-20 bg-muted rounded animate-pulse"></div>
        <div className="h-4 w-32 bg-muted rounded animate-pulse"></div>
      </div>
    </CardContent>
  </Card>
)

export const ChartSkeleton = ({ height = "300px" }: { height?: string }) => (
  <Card>
    <CardHeader className="border-b pb-3">
      <div className="h-5 w-40 bg-muted rounded animate-pulse mb-2"></div>
      <div className="h-4 w-60 bg-muted rounded animate-pulse"></div>
    </CardHeader>
    <CardContent className="pt-6">
      <div className="animate-pulse flex flex-col space-y-4" style={{ height }}>
        <div className="h-6 bg-muted rounded w-1/2 mx-auto"></div>
        <div className="flex-1 bg-muted rounded w-full"></div>
        <div className="flex justify-center space-x-4">
          <div className="h-4 w-16 bg-muted rounded"></div>
          <div className="h-4 w-16 bg-muted rounded"></div>
          <div className="h-4 w-16 bg-muted rounded"></div>
        </div>
      </div>
    </CardContent>
  </Card>
)

export const PieChartSkeleton = () => (
  <Card className="flex flex-col">
    <CardHeader className="border-b pb-3">
      <div className="h-5 w-36 bg-muted rounded animate-pulse mb-2"></div>
      <div className="h-4 w-48 bg-muted rounded animate-pulse"></div>
    </CardHeader>
    <CardContent className="flex-1 pt-6 pb-0">
      <div className="mx-auto aspect-square max-h-[250px] animate-pulse">
        <div className="w-full h-full bg-muted rounded-full"></div>
      </div>
    </CardContent>
  </Card>
)

export const ProductListSkeleton = () => (
  <Card>
    <CardHeader className="border-b pb-3">
      <div className="h-5 w-44 bg-muted rounded animate-pulse"></div>
    </CardHeader>
    <CardContent className="pt-4">
      <div className="space-y-5 animate-pulse">
        {[1, 2, 3].map((section) => (
          <div key={section} className="space-y-2">
            <div className="h-4 w-20 bg-muted rounded"></div>
            <div className="space-y-1">
              {[1, 2, 3].map((item) => (
                <div key={item} className="flex justify-between items-center py-1">
                  <div className="h-4 w-32 bg-muted rounded"></div>
                  <div className="h-4 w-8 bg-muted rounded"></div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
)

export const TablePerformanceSkeleton = () => (
  <Card>
    <CardHeader className="border-b pb-3">
      <div className="h-5 w-40 bg-muted rounded animate-pulse mb-2"></div>
      <div className="h-4 w-56 bg-muted rounded animate-pulse"></div>
    </CardHeader>
    <CardContent className="pt-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-pulse">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((table) => (
          <div
            key={table}
            className="p-4 rounded-lg border bg-muted"
          >
            <div className="space-y-2">
              <div className="h-5 w-16 bg-muted rounded"></div>
              <div className="h-4 w-20 bg-muted rounded"></div>
              <div className="h-4 w-24 bg-muted rounded"></div>
              <div className="h-5 w-18 bg-muted rounded"></div>
              <div className="h-4 w-20 bg-muted rounded"></div>
              <div className="h-5 w-12 bg-muted rounded"></div>
            </div>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
)

export const TableSkeleton = () => (
  <Card>
    <CardHeader className="border-b pb-3">
      <div className="h-5 w-40 bg-muted rounded animate-pulse mb-2"></div>
      <div className="h-4 w-56 bg-muted rounded animate-pulse"></div>
    </CardHeader>
    <CardContent className="p-0">
      <div className="overflow-x-auto animate-pulse">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              {[1, 2, 3, 4, 5, 6].map((header) => (
                <th key={header} className="text-left p-4">
                  <div className="h-4 w-16 bg-muted rounded"></div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4].map((row) => (
              <tr key={row} className="border-b">
                {[1, 2, 3, 4, 5, 6].map((cell) => (
                  <td key={cell} className="p-4">
                    <div className="h-4 w-12 bg-muted rounded"></div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CardContent>
  </Card>
)

export const StaffPerformanceSkeleton = () => (
  <Card>
    <CardHeader className="border-b pb-3">
      <div className="h-5 w-36 bg-muted rounded animate-pulse mb-2"></div>
      <div className="h-4 w-52 bg-muted rounded animate-pulse"></div>
    </CardHeader>
    <CardContent className="pt-6" style={{ height: '360px' }}>
      <div className="space-y-6 animate-pulse">
        <div>
          <div className="h-4 w-32 bg-muted rounded mb-2"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((staff) => (
              <div key={staff} className="flex items-center">
                <div className="w-32 h-4 bg-muted rounded flex-shrink-0"></div>
                <div className="flex-1 ml-4 space-y-1">
                  <div className="flex items-center">
                    <div className="h-2 bg-muted rounded flex-1"></div>
                    <div className="ml-2 h-4 w-16 bg-muted rounded"></div>
                  </div>
                  <div className="h-3 w-40 bg-muted rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="h-4 w-40 bg-muted rounded mb-2"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((category) => (
              <div key={category} className="flex items-center">
                <div className="w-32 h-4 bg-muted rounded flex-shrink-0"></div>
                <div className="flex-1 ml-4">
                  <div className="flex items-center">
                    <div className="flex-1 h-2 bg-muted rounded overflow-hidden"></div>
                    <div className="ml-2 h-4 w-12 bg-muted rounded"></div>
                    <div className="ml-2 h-3 w-16 bg-muted rounded"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
)

// Loading indicator for infinite scroll trigger
export const LoadingSpinner = () => (
  <div className="flex justify-center items-center py-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
  </div>
)

// Section wrapper for progressive loading
export const ProgressiveSection = ({ 
  children, 
  isLoading, 
  skeleton, 
  className = "" 
}: { 
  children: React.ReactNode
  isLoading: boolean
  skeleton: React.ReactNode
  className?: string
}) => (
  <div className={className}>
    {isLoading ? skeleton : children}
  </div>
)