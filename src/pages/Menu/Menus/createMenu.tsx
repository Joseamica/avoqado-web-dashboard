import api from '@/api'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
const daysOfWeek = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
export default function CreateMenu() {
  const { venueId } = useParams()
  // const [selectedCategories, setSelectedCategories] = useState<Option[]>([])
  const [schedule, setSchedule] = useState(
    daysOfWeek.reduce((acc, day) => {
      acc[day] = {
        isOpen24: false,
        startTime: '09:00',
        endTime: '18:00',
      }
      return acc
    }, {}),
  )
  //   console.log('LOG: schedule', schedule)
  const [selectedDays, setSelectedDays] = useState([])
  const [tempStartTime, setTempStartTime] = useState('09:00')
  const [tempEndTime, setTempEndTime] = useState('18:00')
  const [tempIs24h, setTempIs24h] = useState(false)
  // Cambia el valor (hora o abierto 24h) de un día específico en el estado
  const handleDayCheckbox = day => {
    setSelectedDays(prevSelected => {
      if (prevSelected.includes(day)) {
        // Si el día ya estaba seleccionado, lo quitamos
        return prevSelected.filter(d => d !== day)
      } else {
        // Si el día no estaba, lo agregamos
        return [...prevSelected, day]
      }
    })
  }

  // Asigna el horario (tempStartTime, tempEndTime, tempIs24h)
  // a todos los días seleccionados
  const applySchedule = () => {
    const newSchedule = { ...schedule }

    selectedDays.forEach(day => {
      newSchedule[day].isOpen24 = tempIs24h
      newSchedule[day].startTime = tempStartTime
      newSchedule[day].endTime = tempEndTime
    })

    setSchedule(newSchedule)
    // Limpiamos la selección (opcional)
    setSelectedDays([])
  }

  const location = useLocation()
  const { toast } = useToast()
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['necessary-product-creation-data', venueId],
    queryFn: async () => {
      const response = await api.get(`/v2/dashboard/${venueId}/necessary-product-creation-data`)
      return response.data
    },
  })

  const from = (location.state as any)?.from || '/'
  const form = useForm({
    defaultValues: {
      name: '',
      description: '',
      price: '',
      type: '',
      imageUrl: '',
      categories: [],
      modifierGroups: [],
    },
    // values: {
    //   name: data?.avoqadoProduct.name || '',
    //   description: data?.avoqadoProduct.description || '',
    //   imageUrl: data?.avoqadoProduct.imageUrl || '',
    //   categories: [],
    // },
  })
  const createProduct = useMutation({
    mutationFn: async formValues => {
      const response = await api.post(`/v2/dashboard/${venueId}/products`, formValues)
      return response.data
    },
    onSuccess: (_, data: any) => {
      toast({
        title: `Producto ${data.name} creado`,
        description: 'El producto se ha creado correctamente.',
      })
      navigate(from)
    },
    onError: (error: any) => {
      toast({
        title: 'Error al guardar',
        description: error.message || 'Hubo un problema al guardar los cambios.',
        variant: 'destructive',
      })
    },
  })

  function onSubmit(formValues) {
    createProduct.mutate({
      ...formValues,
      // categories: selectedCategories.map(category => category.value),
    })
  }

  if (isLoading) {
    return <div>Cargando...</div>
  }

  if (!data) {
    return <div>Producto no encontrado</div>
  }
  return (
    <div>
      <div className="sticky z-10 flex flex-row justify-between w-full px-4 py-3 mb-4 bg-white border-b-2 top-14">
        <div className="space-x-4 flex-row-center">
          <Link to={from}>
            <ArrowLeft />
          </Link>
          <span>{form.watch('name', '')}</span>
        </div>
        <div className="space-x-3 flex-row-center">
          <Button disabled={!form.formState.isDirty || createProduct.isPending} onClick={form.handleSubmit(onSubmit)}>
            {createProduct.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="px-4 space-y-6 ">
          <FormField
            control={form.control}
            name="name"
            rules={{
              required: { value: true, message: 'El nombre es requerido.' },
              minLength: { value: 3, message: 'El nombre debe tener al menos 3 caracteres.' },
              maxLength: { value: 30, message: 'El nombrre no debe tener más de 30 caracteres.' },
            }}
            render={({ field }) => {
              return (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Introduce un nombre" className="max-w-96" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )
            }}
          />
          <h1 className="text-xl font-semibold">Disponibilidad del menú</h1>
          <div style={{ border: '1px solid #aaa', padding: 16, maxWidth: 500 }}>
            <h2>Horario para Múltiples Días</h2>

            <div>
              <p>
                <strong>1. Selecciona los días a los que asignarás un mismo horario:</strong>
              </p>
              {daysOfWeek.map(day => (
                <label key={day} style={{ marginRight: 12 }}>
                  <input type="checkbox" checked={selectedDays.includes(day)} onChange={() => handleDayCheckbox(day)} /> {day}
                </label>
              ))}
            </div>

            <div style={{ marginTop: 20 }}>
              <p>
                <strong>2. Indica el horario que deseas aplicar a esos días:</strong>
              </p>

              <label style={{ display: 'block', marginBottom: 8 }}>
                <input type="checkbox" checked={tempIs24h} onChange={e => setTempIs24h(e.target.checked)} /> Abierto 24 horas
              </label>

              {/* Si NO es 24h, muestra los inputs de hora */}
              {!tempIs24h && (
                <>
                  <label style={{ marginRight: 10 }}>
                    Inicio: <input type="time" value={tempStartTime} onChange={e => setTempStartTime(e.target.value)} />
                  </label>
                  <label>
                    Fin: <input type="time" value={tempEndTime} onChange={e => setTempEndTime(e.target.value)} />
                  </label>
                </>
              )}

              <div style={{ marginTop: 10 }}>
                <button type="button" onClick={applySchedule}>
                  Asignar horario
                </button>
              </div>
            </div>

            <hr style={{ margin: '20px 0' }} />

            <div>
              <p>
                <strong>3. Vista previa del resultado:</strong>
              </p>
              {selectedDays.map(day => {
                const { isOpen24, startTime, endTime } = schedule[day]
                return (
                  <div key={day} style={{ marginBottom: 8 }}>
                    <strong>{day}:</strong> {isOpen24 ? 'Abierto 24h' : `De ${startTime} a ${endTime}`}
                  </div>
                )
              })}
            </div>

            {/* Puedes mostrar el JSON completo para debugging */}
            {/* <pre>{JSON.stringify(schedule, null, 2)}</pre> */}
          </div>
        </form>
      </Form>
    </div>
  )
}
