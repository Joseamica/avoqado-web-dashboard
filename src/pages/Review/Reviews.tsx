import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import api from '@/api'

import { DateRangePicker } from '@/components/date-range-picker'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function Reviews() {
  const { venueId } = useParams()

  // Guardamos en el estado el rango de fechas seleccionado
  const [selectedRange, setSelectedRange] = useState<{ from: Date; to: Date } | null>(null)

  // Se obtiene la lista de todas las reviews sin filtrar
  const { data: reviews, isLoading } = useQuery({
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
  console.log('LOG: filteredReviews', filteredReviews)
  return (
    <div className="space-y-6 p-4">
      {/* Tarjeta para filtrar reviews usando el DateRangePicker */}
      <Card>
        <CardHeader>
          <CardTitle>Filtrar Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          <DateRangePicker
            showCompare={false}
            onUpdate={({ range }) => {
              setSelectedRange(range)
            }}
            initialDateFrom="2025-01-01"
            initialDateTo="2025-12-31"
            align="start"
            locale="en-GB"
          />
        </CardContent>
      </Card>

      {/* Tarjeta que muestra el resumen de las reviews filtradas */}
      {isLoading ? (
        <p>Cargando reviews...</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Resumen de Reviews</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredReviews && filteredReviews.length > 0 ? (
              <div>
                <p>
                  <strong>Total de reviews:</strong> {filteredReviews.length}
                </p>
                {/* Aquí puedes agregar más datos relevantes, como promedios o estadísticas */}
              </div>
            ) : (
              <p>No se encontraron reviews para el rango seleccionado.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
