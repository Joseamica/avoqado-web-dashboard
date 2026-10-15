import { BookmarkPlus, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { unirPaginas, useOptionLibrary } from '../hooks'
import type { OpcionEditable } from '../combinations'

export function OptionLibraryPicker({ venueId, onPick, disabled }: { venueId: string; onPick: (o: OpcionEditable) => void; disabled?: boolean }) {
  const { t } = useTranslation('variants')
  const [open, setOpen] = useState(false)
  const q = useOptionLibrary(venueId, open)
  const { items, total } = unirPaginas(q.data, o => o.id)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={disabled} data-tour="product-variants-library-picker">
          <BookmarkPlus className="mr-2 h-4 w-4" />
          {t('biblioteca.picker.usar')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start">
        {q.isLoading ? (
          <p className="flex items-center gap-2 p-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t('biblioteca.picker.cargando')}</p>
        ) : q.isError && items.length === 0 ? (
          <div className="space-y-2 p-3 text-sm">
            <p className="text-destructive">{t('biblioteca.picker.error')}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => q.refetch()}>{t('biblioteca.picker.reintentar')}</Button>
          </div>
        ) : items.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">{t('biblioteca.picker.vacia')}</p>
        ) : (
          <div>
            <ul className="max-h-72 space-y-1 overflow-y-auto" aria-label={t('biblioteca.picker.lista', { count: total })}>
              {items.map(o => (
                <li key={o.id}>
                  <button
                    type="button"
                    className="w-full cursor-pointer rounded-md px-3 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                    onClick={() => {
                      onPick({ name: o.name, values: o.values.map(v => v.value) })
                      setOpen(false)
                    }}
                  >
                    <span className="block text-sm font-medium">{o.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{o.values.map(v => v.value).join(', ')}</span>
                    {o.valuesTruncated && <span className="block text-xs text-muted-foreground">{t('biblioteca.picker.truncada', { total: o.valuesTotal })}</span>}
                  </button>
                </li>
              ))}
              {q.hasNextPage && (
                <li>
                  <Button type="button" variant="ghost" size="sm" className="w-full" disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
                    {t('biblioteca.picker.cargarMas', { count: total - items.length })}
                  </Button>
                </li>
              )}
            </ul>
            {q.isError && (
              <div className="space-y-2 p-3 text-sm">
                <p className="text-destructive">{t('biblioteca.picker.errorMas')}</p>
                <Button type="button" size="sm" variant="outline" disabled={q.isFetching} onClick={() => (q.isFetchNextPageError ? q.fetchNextPage() : q.refetch())}>
                  {t('biblioteca.picker.reintentar')}
                </Button>
              </div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
