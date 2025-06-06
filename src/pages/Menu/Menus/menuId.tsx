import React from 'react'
import api from '@/api'
import MultipleSelector from '@/components/multi-selector'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

// ----------------------------
// Helpers y datos iniciales
// ----------------------------
type DayItem = {
  label: string
  selected: boolean
}

type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY'

const initialDays: DayItem[] = [
  { label: 'Lun', selected: false },
  { label: 'Mar', selected: false },
  { label: 'Mié', selected: false },
  { label: 'Jue', selected: false },
  { label: 'Vie', selected: false },
  { label: 'Sáb', selected: false },
  { label: 'Dom', selected: false },
]

function dayLabelToEnum(label: string): DayOfWeek {
  switch (label) {
    case 'Lun':
      return 'MONDAY'
    case 'Mar':
      return 'TUESDAY'
    case 'Mié':
      return 'WEDNESDAY'
    case 'Jue':
      return 'THURSDAY'
    case 'Vie':
      return 'FRIDAY'
    case 'Sáb':
      return 'SATURDAY'
    case 'Dom':
      return 'SUNDAY'
    default:
      return 'MONDAY'
  }
}

function getHourOptions() {
  const options: string[] = []
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hour = h.toString().padStart(2, '0')
      const minute = m.toString().padStart(2, '0')
      options.push(`${hour}:${minute}`)
    }
  }
  return options
}

function convertTo12h(time24: string) {
  const [rawHours, minutes] = time24.split(':').map(Number)
  const ampm = rawHours >= 12 ? 'PM' : 'AM'
  const hours = rawHours % 12 || 12
  return `${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`
}

function parseTimeToMinutes(time: string) {
  const [h, m] = time.split(':')
  return parseInt(h, 10) * 60 + parseInt(m, 10)
}

function timeToPercentage(time: string) {
  return (parseTimeToMinutes(time) / 1440) * 100
}

// ----------------------------
// Componente para editar el menú
// ----------------------------
export default function MenuId() {
  const { venueId, menuId } = useParams()
  const queryClient = useQueryClient()
  const location = useLocation()
  const { toast } = useToast()
  const navigate = useNavigate()
  const from = (location.state as any)?.from || '/'

  // Consulta del menú a editar
  const { data: menuData, isLoading: isMenuLoading } = useQuery({
    queryKey: ['menus', menuId],
    queryFn: async () => {
      const response = await api.get(`/v2/dashboard/${venueId}/avoqado-menus/${menuId}`)
      return response.data
    },
  })

  // Consulta de datos necesarios (por ejemplo, categorías)
  const { data: necessaryData, isLoading: isNecessaryLoading } = useQuery({
    queryKey: ['necessary-avoqado-menu-creation-data', venueId],
    queryFn: async () => {
      const response = await api.get(`/v2/dashboard/${venueId}/necessary-avoqado-menu-creation-data`)
      return response.data
    },
  })

  // Llamamos a useForm siempre, con defaultValues iniciales
  const form = useForm({
    defaultValues: {
      name: '',
      avoqadoMenus: [],
      avoqadoProducts: [],
      categories: [],
      days: initialDays,
      startTime: '09:00',
      endTime: '19:30',
      isActive: true,
      isAllDay: false,
    },
    mode: 'onSubmit',
  })

  // Actualizamos el formulario cuando ya llegan los datos del menú
  React.useEffect(() => {
    if (menuData) {
      const menuDays = menuData.menuDays || []
      const isAllDayValue = menuDays.length > 0 ? menuDays[0].isFixed : false
      const defaultStartTime = menuDays.length > 0 && menuDays[0].startTime ? menuDays[0].startTime : '09:00'
      const defaultEndTime = menuDays.length > 0 && menuDays[0].endTime ? menuDays[0].endTime : '19:30'
      const formDays = initialDays.map(day => ({
        ...day,
        selected: menuDays.some((menuDay: any) => menuDay.day === dayLabelToEnum(day.label)),
      }))
      
      // Map categories for the MultipleSelector
      const categoriesForForm = menuData.categories?.map((category: any) => ({
        label: category.name,
        value: category.id,
        disabled: false,
      })) || []
      
      form.reset({
        name: menuData.name || '',
        avoqadoMenus: menuData.avoqadoMenus || [],
        avoqadoProducts: menuData.avoqadoProducts || [],
        categories: categoriesForForm,
        days: formDays,
        startTime: defaultStartTime,
        endTime: defaultEndTime,
        isActive: menuData.active,
        isAllDay: isAllDayValue,
      })
    }
  }, [menuData, form])

  // Mutation para actualizar el menú
  const updateMenu = useMutation({
    mutationFn: async (formValues: any) => {
      const response = await api.put(`/v2/dashboard/${venueId}/avoqado-menus/${menuId}`, formValues)
      return response.data
    },
    onSuccess: (data: any) => {
      toast({
        title: `Menú ${data.name.toLowerCase()} actualizado.`,
        description: 'El menú se ha actualizado correctamente.',
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

  // Si aún se están cargando datos, mostramos el loading.
  if (isMenuLoading || isNecessaryLoading) {
    return <div>Cargando...</div>
  }

  // Obtenemos valores del formulario
  const days = form.watch('days')
  const startTime = form.watch('startTime')
  const endTime = form.watch('endTime')
  const isAllDay = form.watch('isAllDay')
  const isActive = form.watch('isActive')

  // Funciones para manejar cambios en el formulario
  function toggleDay(dayLabel: string) {
    const updatedDays = days.map((d: DayItem) => (d.label === dayLabel ? { ...d, selected: !d.selected } : d))
    form.setValue('days', updatedDays, { shouldDirty: true })
    if (updatedDays.some((d: DayItem) => d.selected)) {
      form.clearErrors('days')
    }
  }

  function handleToggle(checked: boolean) {
    form.setValue('isActive', checked)
  }

  function handleAllDayChange(e: React.ChangeEvent<HTMLInputElement>) {
    form.setValue('isAllDay', e.target.checked)
    if (e.target.checked) {
      form.clearErrors(['startTime', 'endTime'])
    }
  }

  function onSubmit(formValues: any) {
    form.clearErrors()
    const { name, avoqadoMenus, avoqadoProducts, categories, days, startTime, endTime, isAllDay, isActive } = formValues

    if (!name.trim()) {
      form.setError('name', { type: 'manual', message: 'El nombre es obligatorio' })
    }
    if (!days.some((day: DayItem) => day.selected)) {
      form.setError('days', {
        type: 'manual',
        message: 'Al menos un día tiene que ser seleccionado',
      })
    }
    if (!isAllDay) {
      const startMinutes = parseTimeToMinutes(startTime)
      const endMinutes = parseTimeToMinutes(endTime)
      if (endMinutes - startMinutes < 60) {
        const errorMessage = 'Los horarios del menú no pueden tener intervalos inferiores a 60 minutos. Tienes que cambiarlos.'
        form.setError('startTime', { type: 'manual', message: errorMessage })
        form.setError('endTime', { type: 'manual', message: errorMessage })
      }
    }

    const nameErrors = form.getFieldState('name').error
    const daysErrors = form.getFieldState('days').error
    const startTimeErrors = form.getFieldState('startTime').error
    const endTimeErrors = form.getFieldState('endTime').error
    if (nameErrors || daysErrors || startTimeErrors || endTimeErrors) {
      return
    }

    const selectedDays = days.filter((day: DayItem) => day.selected)
    const menuDaysPayload = selectedDays.map((day: DayItem) => ({
      day: dayLabelToEnum(day.label),
      isFixed: isAllDay,
      startTime: isAllDay ? null : startTime,
      endTime: isAllDay ? null : endTime,
    }))

    // Extract just the category IDs from the MultipleSelector value format
    const categoryIds = categories.map((category: any) => category.value)
    
    const payload = {
      name,
      avoqadoMenus,
      avoqadoProducts,
      categories: categoryIds, // Send only the IDs to the API
      menuDays: menuDaysPayload,
      active: isActive,
    }

    updateMenu.mutate(payload)
  }

  // Cálculo para la barra de horas
  const startPercent = timeToPercentage(startTime)
  const endPercent = timeToPercentage(endTime)
  const barLeft = Math.min(startPercent, endPercent)
  const barRight = Math.max(startPercent, endPercent)
  const hourOptions = getHourOptions()

  return (
    <div>
      <div className="sticky z-10 flex flex-row justify-between w-full px-4 py-3 mb-4 bg-white border-b-2 top-14">
        <div className="space-x-4 flex-row-center">
          <Link to={from}>
            <ArrowLeft />
          </Link>
          <span>{form.watch('name')}</span>
        </div>
        <div className="space-x-3 flex-row-center">
          <Button 
            disabled={!form.formState.isDirty || updateMenu.isPending} 
            onClick={form.handleSubmit(onSubmit)}
            variant="default"
          >
            {updateMenu.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 space-y-6">
          <div className="max-w-2xl p-4 space-y-4 border rounded-md">
            <div className="flex items-center justify-between mb-4">
              <span className="mr-2 font-bold">El menú está activo</span>
              <Switch checked={isActive} onCheckedChange={handleToggle} />
            </div>
            <p className="mb-3 text-sm">Los clientes pueden ver este menú y hacer pedidos</p>
            
            <FormField
              control={form.control}
              name="name"
              rules={{
                required: { value: true, message: 'El nombre es obligatorio' },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del Menú</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej. Desayunos" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="space-y-2">
              <FormLabel>Días disponibles</FormLabel>
              <div className="flex w-full mb-2">
                {days.map((day: DayItem) => (
                  <button
                    type="button"
                    key={day.label}
                    onClick={() => toggleDay(day.label)}
                    className={
                      'px-3 py-1 cursor-pointer transition-colors w-full ' + 
                      (day.selected ? 'bg-black text-white' : 'bg-gray-200 text-black')
                    }
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              {form.formState.errors.days && (
                <p className="text-sm text-red-500">{form.formState.errors.days.message?.toString()}</p>
              )}
            </div>
            
            <div className="relative w-full h-6 overflow-hidden bg-gray-100 rounded-sm">
              {!isAllDay && (
                <div 
                  className="absolute top-0 bottom-0 bg-green-500" 
                  style={{ left: `${barLeft}%`, width: `${barRight - barLeft}%` }} 
                />
              )}
              {isAllDay && <div className="absolute top-0 bottom-0 w-full bg-green-500" />}
            </div>
            
            <div className="flex justify-between w-full text-xs text-gray-500">
              <span>00:00</span>
              <span>03:00</span>
              <span>06:00</span>
              <span>09:00</span>
              <span>12:00</span>
              <span>15:00</span>
              <span>18:00</span>
              <span>21:00</span>
              <span>24:00</span>
            </div>
            
            <div className="flex items-center space-x-4">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hora de inicio</FormLabel>
                    <Select
                      disabled={isAllDay}
                      value={field.value}
                      onValueChange={value => {
                        field.onChange(value);
                        if (form.formState.errors.startTime) form.clearErrors('startTime');
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Selecciona hora</SelectLabel>
                          {hourOptions.map(time => (
                            <SelectItem key={time} value={time}>
                              {convertTo12h(time)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hora de finalización</FormLabel>
                    <Select
                      disabled={isAllDay}
                      value={field.value}
                      onValueChange={value => {
                        field.onChange(value);
                        if (form.formState.errors.endTime) form.clearErrors('endTime');
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Selecciona hora</SelectLabel>
                          {hourOptions.map(time => (
                            <SelectItem key={time} value={time}>
                              {convertTo12h(time)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <input 
                id="allDay" 
                type="checkbox" 
                className="w-4 h-4" 
                checked={isAllDay} 
                onChange={handleAllDayChange} 
              />
              <label htmlFor="allDay" className="text-sm font-semibold">
                Abierto 24 horas
              </label>
            </div>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Categorías</h2>
            <FormField
              control={form.control}
              name="categories"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <MultipleSelector
                      {...field}
                      options={necessaryData.categories.map((category: any) => ({
                        label: category.name,
                        value: category.id,
                        disabled: false,
                      }))}
                      hidePlaceholderWhenSelected
                      placeholder="Selecciona las categorías"
                      emptyIndicator="No se han encontrado mas categorías"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </form>
      </Form>
    </div>
  )
}
