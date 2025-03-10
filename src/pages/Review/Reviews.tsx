import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Star, ArrowRight } from 'lucide-react'
import api from '@/api'
import { useParams } from 'react-router-dom'
import { DateRangePicker } from '@/components/date-range-picker'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
export default function ReviewSummary() {
  const { venueId } = useParams()

  const [selectedRange, setSelectedRange] = useState<{ from: Date; to: Date } | null>(null)

  // Se obtiene la lista de todas las reviews sin filtrar
  const {
    data: reviews,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['reviews', venueId],
    queryFn: async () => {
      const response = await api.get(`/v2/dashboard/${venueId}/reviews`)
      return response.data
    },
  })

  // Filtrar las reviews en el frontend según el rango seleccionado
  const filteredReviews =
    selectedRange && reviews
      ? reviews.filter((review: { createdAt: string }) => {
          const reviewDate = new Date(review.createdAt)
          return reviewDate >= selectedRange.from && reviewDate <= selectedRange.to
        })
      : reviews
  // Procesamos las reseñas y asignamos valores por defecto

  // Calculamos el promedio numérico de las estrellas
  const average = filteredReviews?.length > 0 ? filteredReviews.reduce((sum, review) => sum + review.stars, 0) / filteredReviews?.length : 0

  const averageRating = filteredReviews?.length > 0 ? average.toFixed(1) : 'N/A'

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold">Reseñas</h1>
      <DateRangePicker
        showCompare={false}
        onUpdate={({ range }) => {
          setSelectedRange(range)
        }}
        initialDateFrom="2020-01-01"
        initialDateTo="2030-12-31"
        align="start"
        locale="es-ES"
      />
      <Card className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <CardHeader>
            <CardTitle>Establecimientos</CardTitle>
            <CardDescription>
              Media de las valoraciones basadas en <span className="font-semibold">{filteredReviews?.length} reseñas.</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p>Cargando reseñas...</p>
            ) : error ? (
              <p>Error al cargar reseñas.</p>
            ) : (
              <>
                <div className="flex flex-col items-center">
                  <div className="text-4xl font-bold mb-2">{averageRating}</div>
                  <div className="flex items-center space-x-1 mb-4">
                    {[...Array(Math.round(average))].map((_, i) => (
                      <Star key={i} className="text-yellow-500 fill-yellow-500" size={20} />
                    ))}
                  </div>
                </div>
                <TooltipProvider delayDuration={100}>
                  <ul className="text-gray-600 space-y-1">
                    {[5, 4, 3, 2, 1].map(stars => {
                      const count = filteredReviews?.filter(r => r.stars === stars).length || 0
                      const percentage = filteredReviews?.length > 0 ? (count / filteredReviews?.length) * 100 : 0

                      return (
                        <li key={stars} className="flex items-center space-x-2 flex-row">
                          <span className="shrink-0 w-20">
                            {stars} {stars === 1 ? 'estrella' : 'estrellas'}
                          </span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="w-full h-3 bg-gray-200 rounded">
                                <div className="h-full bg-yellow-500 rounded" style={{ width: `${percentage}%` }}></div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{`${count} reseña${count === 1 ? '' : 's'}`}</p>
                            </TooltipContent>
                          </Tooltip>
                        </li>
                      )
                    })}
                  </ul>
                </TooltipProvider>
              </>
            )}
            {/* 
            <Button className="mt-4" variant="outline">
              Ver opiniones <ArrowRight className="ml-2" size={16} />
            </Button> */}
          </CardContent>
        </div>
      </Card>
    </div>
  )
}
