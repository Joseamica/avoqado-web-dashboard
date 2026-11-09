import DataTable from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { EstadoDeCarga } from '@/lib/falloDeCarga'
import type { FilaDePromotor } from '@/services/celularesDeCampo.service'
import { useVenueDateTime } from '@/utils/datetime'
import { getDateFnsLocale } from '@/utils/i18n-locale'
import type { ColumnDef, PaginationState } from '@tanstack/react-table'
import { formatDistanceToNow } from 'date-fns'
import { Copy, KeyRound, MessageCircle, RefreshCw, Smartphone, Unlink } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { tienePin, useMandarCodigo } from '../ayudantes'

interface TablaDeCelularesProps {
  query: EstadoDeCarga
  filas: FilaDePromotor[]
  total: number
  isLoading: boolean
  pagination: PaginationState
  setPagination: Dispatch<SetStateAction<PaginationState>>
  /** Montada en la sucursal: el PIN que se enseña es el de esa sucursal. */
  venueIdInicial?: string
  generandoCodigo: boolean
  onGenerarCodigo: (fila: FilaDePromotor) => void
  onPin: (fila: FilaDePromotor) => void
  onDesvincular: (fila: FilaDePromotor) => void
}

export function TablaDeCelulares({
  query,
  filas,
  total,
  isLoading,
  pagination,
  setPagination,
  venueIdInicial,
  generandoCodigo,
  onGenerarCodigo,
  onPin,
  onDesvincular,
}: TablaDeCelularesProps) {
  const { t, i18n } = useTranslation('organization')
  const { formatDate } = useVenueDateTime()
  const { copiar, mandarPorWhatsApp } = useMandarCodigo()
  const locale = getDateFnsLocale(i18n.language)

  const columns = useMemo<ColumnDef<FilaDePromotor>[]>(() => {
    const hace = (fecha: string) => formatDistanceToNow(new Date(fecha), { addSuffix: true, locale })
    return [
      {
        id: 'promotor',
        header: t('celulares.columnas.promotor', { defaultValue: 'Promotor' }),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-medium truncate">{row.original.nombre}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.telefono ?? t('celulares.sinTelefono', { defaultValue: 'Sin teléfono' })}
            </p>
          </div>
        ),
      },
      {
        id: 'sucursales',
        header: t('celulares.columnas.sucursal', { defaultValue: 'Sucursal' }),
        cell: ({ row }) => <span className="text-sm">{row.original.sucursales.map(s => s.nombre).join(', ') || '—'}</span>,
      },
      {
        id: 'estado',
        header: t('celulares.columnas.estado', { defaultValue: 'Estado' }),
        cell: ({ row }) => {
          const f = row.original
          if (f.estado === 'ACTIVO') {
            const aparato = [f.celular?.marca, f.celular?.modelo].filter(Boolean).join(' ')
            return (
              <Badge variant="outline" className="border-input">
                {aparato
                  ? t('celulares.estado.ACTIVO', {
                      marca: f.celular?.marca ?? '',
                      modelo: f.celular?.modelo ?? '',
                      defaultValue: 'Activado · {{marca}} {{modelo}}',
                    }).trim()
                  : t('celulares.estadoFiltro.ACTIVO', { defaultValue: 'Activado' })}
              </Badge>
            )
          }
          if (f.estado === 'CODIGO_SIN_USAR' && f.codigo) {
            return (
              <Badge variant="outline" className="border-input">
                {t('celulares.estado.CODIGO_SIN_USAR', {
                  fecha: formatDate(f.codigo.expiraAt),
                  defaultValue: 'Código sin usar · vence {{fecha}}',
                })}
              </Badge>
            )
          }
          return (
            <Badge variant="secondary">{t('celulares.estado.SIN_CELULAR', { defaultValue: 'Sin celular' })}</Badge>
          )
        },
      },
      {
        id: 'visto',
        header: t('celulares.columnas.visto', { defaultValue: 'Último contacto' }),
        cell: ({ row }) => {
          const vistoAt = row.original.celular?.vistoAt
          return (
            <span className="text-sm text-muted-foreground">
              {vistoAt ? t('celulares.visto', { hace: hace(vistoAt), defaultValue: 'Visto {{hace}}' }) : '—'}
            </span>
          )
        },
      },
      {
        id: 'checada',
        header: t('celulares.columnas.checada', { defaultValue: 'Checada' }),
        cell: ({ row }) => {
          const c = row.original.ultimaChecada
          if (!c) return <span className="text-sm text-muted-foreground">—</span>
          return (
            <span className="text-sm" title={hace(c.at)}>
              {c.conUbicacion
                ? t('celulares.checoConUbicacion', { defaultValue: 'Checó con ubicación' })
                : t('celulares.checoSinUbicacion', { defaultValue: 'Checó sin ubicación' })}
            </span>
          )
        },
      },
      {
        id: 'porSubir',
        header: t('celulares.columnas.porSubir', { defaultValue: 'Por subir' }),
        cell: ({ row }) => {
          const n = row.original.celular?.porSubir
          if (n === undefined) return <span className="text-sm text-muted-foreground">—</span>
          return (
            <span className={n > 0 ? 'text-sm font-medium' : 'text-sm text-muted-foreground'}>
              {t('celulares.porSubir', { n, defaultValue: 'Por subir: {{n}}' })}
            </span>
          )
        },
      },
      {
        id: 'acciones',
        header: '',
        cell: ({ row }) => {
          const f = row.original
          const codigo = f.estado === 'CODIGO_SIN_USAR' ? f.codigo : null
          return (
            <div className="flex flex-wrap justify-end gap-1" onClick={e => e.stopPropagation()}>
              {codigo && (
                <>
                  <Button variant="ghost" size="sm" className="cursor-pointer" onClick={() => copiar(codigo.codigo)}>
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    {t('celulares.acciones.copiar', { defaultValue: 'Copiar' })}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="cursor-pointer"
                    onClick={() => mandarPorWhatsApp({ nombre: f.nombre, telefono: f.telefono, ...codigo })}
                  >
                    <MessageCircle className="h-3.5 w-3.5 mr-1" />
                    {t('celulares.acciones.whatsapp', { defaultValue: 'Mandar por WhatsApp' })}
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="cursor-pointer"
                disabled={generandoCodigo}
                onClick={() => onGenerarCodigo(f)}
              >
                {f.estado === 'SIN_CELULAR' ? (
                  <Smartphone className="h-3.5 w-3.5 mr-1" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                )}
                {f.estado === 'SIN_CELULAR'
                  ? t('celulares.acciones.generar', { defaultValue: 'Generar código' })
                  : t('celulares.acciones.generarOtro', { defaultValue: 'Generar otro' })}
              </Button>
              <Button variant="ghost" size="sm" className="cursor-pointer" onClick={() => onPin(f)}>
                <KeyRound className="h-3.5 w-3.5 mr-1" />
                {tienePin(f, venueIdInicial)
                  ? t('celulares.acciones.cambiarPin', { defaultValue: 'Cambiar PIN' })
                  : t('celulares.acciones.ponerPin', { defaultValue: 'Poner PIN' })}
              </Button>
              {f.celular && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="cursor-pointer text-destructive hover:text-destructive"
                  onClick={() => onDesvincular(f)}
                >
                  <Unlink className="h-3.5 w-3.5 mr-1" />
                  {t('celulares.acciones.desvincular', { defaultValue: 'Desvincular' })}
                </Button>
              )}
            </div>
          )
        },
      },
    ]
  }, [t, locale, formatDate, copiar, mandarPorWhatsApp, generandoCodigo, onGenerarCodigo, onPin, onDesvincular, venueIdInicial])

  return (
    <DataTable<FilaDePromotor>
      query={query}
      data={filas}
      rowCount={total}
      columns={columns}
      isLoading={isLoading}
      pagination={pagination}
      setPagination={setPagination}
      getRowId={f => f.staffId}
      showColumnCustomizer={false}
      tableId="celulares-de-promotores"
    />
  )
}
