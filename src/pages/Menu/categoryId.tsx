import api from '@/api'
import { Button } from '@/components/ui/button'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'

export default function CategoryId() {
  const { venueId, categoryId } = useParams()
  const location = useLocation()

  const { data, isLoading, isError, error, isSuccess } = useQuery({
    queryKey: ['category', categoryId],
    queryFn: async () => {
      const response = await api.get(`/v1/dashboard/${venueId}/categories/${categoryId}`)
      return response.data
    },
  })
  const from = (location.state as any)?.from || '/'

  if (isLoading) return <div className="p-4">Loading...</div>

  return (
    <div className="p-4">
      <div className="flex flex-row justify-between">
        <div className="space-x-4 flex-row-center">
          <Link to={from}>
            <ArrowLeft />
          </Link>
          <span>{data.category.name}</span>
        </div>
        <div className="space-x-3 flex-row-center">
          <Button variant="outline">Eliminar</Button>
          <Button variant="outline">Duplicar</Button>
          <Button variant="outline">Guardar</Button>
        </div>
      </div>
      <div>
        <h1>Menús en los que aparece la categoria</h1>
        <ul>
          {data.avoqadoMenus.map(menu => {
            return (
              <li key={menu.id}>
                <Link to={`/venues/${venueId}/menumaker/menus/${menu.id}`}>{menu.name}</Link>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
