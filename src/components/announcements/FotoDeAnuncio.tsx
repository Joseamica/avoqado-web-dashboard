import { useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

interface FotoDeAnuncioProps {
  url: string
  alt: string
  width?: number
  height?: number
  caption?: string
}

/**
 * Foto de un anuncio: SIEMPRE completa (object-contain, nunca recortada), a lo ancho del
 * contenido y con tope de 480 px de alto. Con medidas reserva el espacio antes de cargar;
 * sin ellas (anuncios viejos) se ve completa con el mismo tope. Al tocarla se abre grande.
 */
export function FotoDeAnuncio({ url, alt, width, height, caption }: FotoDeAnuncioProps) {
  const [open, setOpen] = useState(false)
  const conMedidas = Boolean(width && height)

  return (
    <figure className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={alt || 'Ver foto'}
        className="block w-full cursor-zoom-in overflow-hidden rounded-lg bg-muted"
      >
        <img
          src={url}
          alt={alt}
          width={width}
          height={height}
          loading="lazy"
          style={conMedidas ? { aspectRatio: `${width} / ${height}` } : undefined}
          className="mx-auto h-auto max-h-[480px] w-full object-contain"
        />
      </button>
      {caption ? <figcaption className="text-xs text-muted-foreground">{caption}</figcaption> : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-w-[95vw] items-center justify-center border-0 bg-neutral-950/90 p-2 pt-14 sm:max-w-[95vw] [&>button]:rounded-full [&>button]:bg-neutral-800/80 [&>button]:p-1.5 [&>button]:text-neutral-50 [&>button]:opacity-100">
          <DialogTitle className="sr-only">{alt || 'Foto'}</DialogTitle>
          <img src={url} alt={alt} className="max-h-[80vh] max-w-full object-contain" />
        </DialogContent>
      </Dialog>
    </figure>
  )
}
