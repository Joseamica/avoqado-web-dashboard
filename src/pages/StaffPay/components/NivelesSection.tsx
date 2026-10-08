import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Archive, Check, Pencil, Plus, X } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { useCreateLevel, useUpdateLevel } from '@/hooks/useStaffPay'
import type { NivelDto } from '@/types/staffPay'
import { usePermisoDeConfigurar } from '../permisoDeConfigurar'

const mensajeDeError = (err: any, fallback: string): string => err?.response?.data?.message ?? fallback

/** Niveles: alta, renombrar ahí mismo y archivar (con confirmación). Escribir exige `staffpay:manage`. */
export function NivelesSection({ activos }: { activos: NivelDto[] }) {
  const { t } = useTranslation('staffPay')
  const { toast } = useToast()
  const permiso = usePermisoDeConfigurar()
  const crearNivel = useCreateLevel()
  const actualizar = useUpdateLevel()
  const [nuevoNivel, setNuevoNivel] = useState('')
  const [editando, setEditando] = useState<{ id: string; nombre: string } | null>(null)
  const [porArchivar, setPorArchivar] = useState<NivelDto | null>(null)

  const fallar = (err: unknown) => toast({ title: mensajeDeError(err, t('errors.generic')), variant: 'destructive' })
  const agregar = () => {
    const nombre = nuevoNivel.trim()
    if (!nombre) return
    crearNivel.mutate(nombre, { onSuccess: () => setNuevoNivel(''), onError: fallar })
  }
  const guardarNombre = () => {
    if (!editando) return
    const nombre = editando.nombre.trim()
    if (!nombre) return
    actualizar.mutate(
      { levelId: editando.id, name: nombre },
      { onSuccess: () => { setEditando(null); toast({ title: t('levels.renamed') }) }, onError: fallar },
    )
  }
  const archivar = () => {
    if (!porArchivar) return
    actualizar.mutate(
      { levelId: porArchivar.id, archived: true },
      { onSuccess: () => toast({ title: t('levels.archived') }), onError: fallar },
    )
    setPorArchivar(null)
  }

  return (
    <section className="rounded-lg border border-input p-4 space-y-3">
      <h3 className="font-semibold">{t('levels.title')}</h3>
      {activos.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('levels.empty')}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {activos.map(n =>
            editando?.id === n.id ? (
              <form
                key={n.id}
                className="inline-flex items-center gap-1"
                onSubmit={e => { e.preventDefault(); guardarNombre() }}
              >
                <Input
                  autoFocus
                  aria-label={t('levels.newName')}
                  className="h-8 w-40"
                  value={editando.nombre}
                  onChange={e => setEditando({ id: n.id, nombre: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Escape') setEditando(null) }}
                />
                <Button
                  type="submit"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 cursor-pointer"
                  aria-label={t('levels.save')}
                  disabled={!editando.nombre.trim() || actualizar.isPending}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 cursor-pointer"
                  aria-label={t('levels.cancel')}
                  onClick={() => setEditando(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </form>
            ) : (
              <span key={n.id} className="inline-flex items-center gap-1 rounded-full bg-muted pl-3 pr-1 py-1 text-sm">
                {n.name}
                {permiso.aqui && (
                  <>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 cursor-pointer"
                    aria-label={t('levels.rename', { name: n.name })}
                    title={t('levels.rename', { name: n.name })}
                    disabled={!permiso.puede}
                    onClick={() => setEditando({ id: n.id, nombre: n.name })}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 cursor-pointer"
                    aria-label={t('levels.archiveLevel', { name: n.name })}
                    title={t('levels.archiveLevel', { name: n.name })}
                    disabled={!permiso.puede}
                    onClick={() => setPorArchivar(n)}
                  >
                    <Archive className="h-3 w-3" />
                  </Button>
                  </>
                )}
              </span>
            ),
          )}
        </div>
      )}
      {permiso.aqui && (
        <>
        <form className="flex gap-2 max-w-md" onSubmit={e => { e.preventDefault(); agregar() }}>
          <Input
            value={nuevoNivel}
            disabled={!permiso.puede}
            aria-label={t('levels.namePlaceholder')}
            placeholder={t('levels.namePlaceholder')}
            onChange={e => setNuevoNivel(e.target.value)}
            data-tour="staffpay-level-name"
          />
          <Button type="submit" className="cursor-pointer" disabled={!permiso.puede || !nuevoNivel.trim() || crearNivel.isPending} data-tour="staffpay-level-add">
            <Plus className="h-4 w-4 mr-1" />{t('levels.add')}
          </Button>
        </form>
        {permiso.falta && <p className="text-xs text-muted-foreground">{t('orgConfigPermission')}</p>}
        </>
      )}

      <AlertDialog open={!!porArchivar} onOpenChange={o => { if (!o) setPorArchivar(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('levels.archiveTitle', { name: porArchivar?.name ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>{t('levels.archiveDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">{t('levels.cancel')}</AlertDialogCancel>
            <AlertDialogAction className="cursor-pointer" onClick={archivar}>{t('levels.archiveConfirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
