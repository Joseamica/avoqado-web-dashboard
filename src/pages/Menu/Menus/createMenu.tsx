import { createMenu, getMenuCategories } from '@/services/menu.service'
import { LoadingButton } from '@/components/loading-button'
import MultipleSelector from '@/components/multi-selector'
import { LoadingScreen } from '@/components/spinner'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'

import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import React from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useCurrentVenue } from '@/hooks/use-current-venue'

// --------------------------------------------------
// Tipos y datos iniciales
// --------------------------------------------------
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

// --------------------------------------------------
// Helpers para días
// --------------------------------------------------
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

// --------------------------------------------------
// Helpers para horas
// --------------------------------------------------
/** Genera "HH:mm" desde 00:00 hasta 23:59 en intervalos de 30 min. */
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

/** Convierte "HH:mm" a formato 12h "hh:mm AM/PM". */
function convertTo12h(time24: string) {
  // Separas en dos variables, "rawHours" (para luego modificar) y "minutes" (que no cambia)
  const [rawHours, minutes] = time24.split(':').map(Number)

  // Determinas AM o PM
  const ampm = rawHours >= 12 ? 'PM' : 'AM'

  // Calculas la hora en formato 12h (si es 0, pones 12 para que no sea "00")
  const hours = rawHours % 12 || 12

  // Retornas el string resultante
  return `${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`
}

/** Convierte "HH:mm" a número de minutos (0..1439). */
function parseTimeToMinutes(time: string) {
  const [h, m] = time.split(':')
  return parseInt(h, 10) * 60 + parseInt(m, 10)
}

/** Para la barra verde: pasa "HH:mm" -> porcentaje (0% = 00:00, 100% = 24:00). */
function timeToPercentage(time: string) {
  return (parseTimeToMinutes(time) / 1440) * 100
}

// --------------------------------------------------
// Componente principal
// --------------------------------------------------
export default function MenuScheduleWithMenuDayModel() {
  const navigate = useNavigate()
  const { venueId } = useCurrentVenue()
  const location = useLocation()
  const { toast } = useToast()

  const { data: categories, isLoading } = useQuery({
    queryKey: ['menu-categories', venueId],
    queryFn: () => getMenuCategories(venueId!),
    enabled: !!venueId,
  })

  // 1) useForm con valores por defecto
  const form = useForm({
    defaultValues: {
      name: '',
      avoqadoMenus: [],
      avoqadoProducts: [],
      days: initialDays,
      startTime: '09:00',
      endTime: '19:30',
      isActive: true,
      isAllDay: false,
    },
    mode: 'onSubmit',
  })

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    clearErrors,
    getFieldState,
    formState: { errors },
  } = form

  const days = watch('days')
  const startTime = watch('startTime')
  const endTime = watch('endTime')
  const isAllDay = watch('isAllDay')
  const isActive = watch('isActive')
  const from = (location.state as any)?.from || '/'

  // 2) Mutación con react-query
  const createMenuMutation = useMutation({
    mutationFn: async (formValues: any) => {
      return await createMenu(venueId, formValues)
    },
    onSuccess: (data: any) => {
      toast({
        title: `Categoría ${data.name.toLowerCase()} creada.`,
        description: 'La categoría se ha creado correctamente.',
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

  // 3) Manejadores de días, checkbox y validaciones
  function toggleDay(dayLabel: string) {
    const updatedDays = days.map(d => (d.label === dayLabel ? { ...d, selected: !d.selected } : d))
    setValue('days', updatedDays, { shouldDirty: true })

    // Si ahora tenemos al menos un día seleccionado, limpiamos el error en "days"
    if (updatedDays.some(d => d.selected)) {
      clearErrors('days')
    }
  }

  function handleToggle(checked: boolean) {
    // Ajustamos el estado local primero
    setValue('isActive', checked)

    // Disparamos la mutación
  }

  // Si se activa/desactiva "Abierto 24 horas", limpiamos errores de horarios
  function handleAllDayChange(e: React.ChangeEvent<HTMLInputElement>) {
    setValue('isAllDay', e.target.checked)
    if (e.target.checked) {
      clearErrors(['startTime', 'endTime'])
    }
  }

  // onSubmit con validaciones personalizadas
  function onSubmit(formValues: any) {
    clearErrors() // Limpia cualquier error previo

    const { name, avoqadoMenus, avoqadoProducts, days, startTime, endTime, isAllDay, isActive } = formValues

    // 1) Nombre obligatorio
    if (!name.trim()) {
      setError('name', {
        type: 'manual',
        message: 'El nombre es obligatorio',
      })
    }

    // 2) Al menos un día seleccionado
    if (!days.some((day: DayItem) => day.selected)) {
      setError('days', {
        type: 'manual',
        message: 'Al menos un día tiene que ser seleccionado',
      })
    }

    // 3) Si NO es 24h, validamos intervalo >= 60 min
    if (!isAllDay) {
      const startMinutes = parseTimeToMinutes(startTime)
      const endMinutes = parseTimeToMinutes(endTime)
      const diff = endMinutes - startMinutes

      if (diff < 60) {
        const errorMessage = 'Los horarios del menú no pueden tener intervalos inferiores a 60 minutos. Tienes que cambiarlos.'
        setError('startTime', { type: 'manual', message: errorMessage })
        setError('endTime', { type: 'manual', message: errorMessage })
      }
    }

    // Comprobamos si quedó algún error
    const nameErrors = getFieldState('name').error
    const daysErrors = getFieldState('days').error
    const startTimeErrors = getFieldState('startTime').error
    const endTimeErrors = getFieldState('endTime').error

    if (nameErrors || daysErrors || startTimeErrors || endTimeErrors) {
      // Si hay errores, detenemos
      return
    }

    // Si pasa todas las validaciones, construimos "menuDays" y enviamos
    const selectedDays = days.filter((day: DayItem) => day.selected)
    const menuDays = selectedDays.map((day: DayItem) => ({
      day: dayLabelToEnum(day.label),
      isFixed: isAllDay,
      startTime: isAllDay ? null : startTime,
      endTime: isAllDay ? null : endTime,
    }))

    const payload = {
      name,
      avoqadoMenus,
      avoqadoProducts,
      menuDays,
      active: isActive,
    }

    createMenuMutation.mutate(payload)
  }

  // Para la barra verde de horas
  const startPercent = timeToPercentage(startTime)
  const endPercent = timeToPercentage(endTime)
  const barLeft = Math.min(startPercent, endPercent)
  const barRight = Math.max(startPercent, endPercent)

  // Preparamos las opciones de hora
  const hourOptions = getHourOptions()

  if (isLoading) {
    return <LoadingScreen message="Cargando..." />
  }

  return (
    <div>
      <div className="sticky z-10 flex flex-row justify-between w-full px-4 py-3 mb-4 bg-background border-b-2 top-14">
        <div className="space-x-4 flex-row-center">
          <Link to={from}>
            <ArrowLeft />
          </Link>
          <span>{watch('name')}</span>
        </div>
        <div className="space-x-3 flex-row-center">
          <LoadingButton loading={createMenuMutation.isPending} onClick={handleSubmit(onSubmit)} variant="default">
            {createMenuMutation.isPending ? 'Guardando...' : 'Guardar'}
          </LoadingButton>
        </div>
      </div>

      <div className="p-4">
        <div className="max-w-2xl p-4 space-y-4 border rounded-md">
          <div className="flex items-center justify-between mb-4">
            <span className="mr-2 font-bold">El menú está activo</span>
            <Switch checked={isActive} onCheckedChange={handleToggle} />
          </div>
          <p className="mb-3 text-sm">Los clientes pueden ver este menú y hacer pedidos</p>
          {/* Campo "name" */}
          <div>
            <label className="block mb-1 text-sm font-medium">Nombre del Menú</label>
            <input type="text" placeholder="Ej. Desayunos" className="w-full p-2 border rounded-sm" {...register('name')} />
            {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>}
          </div>
          {/* Botones de días */}
          <div className="flex w-full mb-2 ">
            {days.map(day => (
              <button
                type="button"
                key={day.label}
                onClick={() => toggleDay(day.label)}
                className={
                  'px-3 py-1 cursor-pointer transition-colors w-full ' + (day.selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground')
                }
              >
                {day.label}
              </button>
            ))}
          </div>
          {errors.days && <p className="text-sm text-red-500">{errors.days.message}</p>}
          {/* Barra de horas */}
          <div className="relative w-full h-6 overflow-hidden bg-muted rounded-sm">
            {!isAllDay && (
              <div
                className="absolute top-0 bottom-0 bg-green-500"
                style={{
                  left: `${barLeft}%`,
                  width: `${barRight - barLeft}%`,
                }}
              />
            )}
            {isAllDay && <div className="absolute top-0 bottom-0 w-full bg-green-500" />}
          </div>
          {/* Etiquetas de cada 3 horas (opcional) */}
          <div className="flex justify-between w-full text-xs text-muted-foreground">
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
          {/* Sección Hora de inicio y fin */}
          <div className="flex items-center space-x-4">
            {/* Hora de inicio */}
            <div>
              <label className="block mb-1 text-sm font-medium">Hora de inicio</label>
              <Select
                disabled={isAllDay}
                value={startTime}
                onValueChange={value => {
                  setValue('startTime', value)
                  // Si cambiamos la hora manualmente, limpiamos error
                  if (errors.startTime) {
                    clearErrors('startTime')
                  }
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
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
              {errors.startTime && <p className="mt-1 text-sm text-red-500">{errors.startTime.message}</p>}
            </div>
            {/* Hora de fin */}
            <div>
              <label className="block mb-1 text-sm font-medium">Hora de finalización</label>
              <Select
                disabled={isAllDay}
                value={endTime}
                onValueChange={value => {
                  setValue('endTime', value)
                  if (errors.endTime) {
                    clearErrors('endTime')
                  }
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
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
              {errors.endTime && <p className="mt-1 text-sm text-red-500">{errors.endTime.message}</p>}
            </div>
          </div>
          {/* Checkbox de "Abierto 24 horas" */}
          <div className="flex items-center space-x-2">
            <input id="allDay" type="checkbox" className="w-4 h-4" checked={isAllDay} onChange={handleAllDayChange} />
            <label htmlFor="allDay" className="text-sm font-semibold">
              Abierto 24 horas
            </label>
          </div>
        </div>
        <h2 className="mt-4 mb-2 text-lg font-semibold">Categorías</h2>

        <MultipleSelector
          options={(categories ?? []).map(category => ({
            label: category.name,
            value: category.id,
            disabled: false,
          }))}
          hidePlaceholderWhenSelected
          placeholder="Selecciona las categorías"
          emptyIndicator="No se han encontrado mas categorías"
        />
      </div>
    </div>
  )
}
