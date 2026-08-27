import type { ContentBlock } from '@/services/announcement.service'

/**
 * Pinta los bloques del contenido ampliado de un anuncio.
 *
 * 🔴 Un `type` que este cliente no conozca se ignora en silencio. Es lo que permite
 * agregar bloques nuevos en el servidor sin tener que desplegar este dashboard — y lo
 * que evita que una versión vieja se rompa con un anuncio nuevo.
 */
export function AnnouncementBlocks({ blocks }: { blocks?: ContentBlock[] | null }) {
  if (!blocks?.length) return null

  return (
    <div className="space-y-5">
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'heading':
            return (
              <h3 key={i} className="text-base font-semibold text-foreground">
                {String(block.text ?? '')}
              </h3>
            )

          case 'paragraph':
            return (
              <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                {String(block.text ?? '')}
              </p>
            )

          case 'bullets':
            return (
              <ul key={i} className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                {(block.items as string[]).filter(Boolean).map((item, k) => (
                  <li key={k}>{item}</li>
                ))}
              </ul>
            )

          case 'image':
            return (
              <figure key={i} className="space-y-2">
                <img
                  src={String(block.url)}
                  alt={String(block.alt ?? '')}
                  loading="lazy"
                  className="w-full rounded-lg border border-border object-cover"
                />
                {block.caption ? (
                  <figcaption className="text-xs text-muted-foreground">{String(block.caption)}</figcaption>
                ) : null}
              </figure>
            )

          case 'gallery':
            return (
              <div key={i} className="grid grid-cols-2 gap-3">
                {(block.images as Array<{ url: string; alt: string }>).map((img, k) => (
                  <img
                    key={k}
                    src={img.url}
                    alt={img.alt}
                    loading="lazy"
                    className="w-full rounded-lg border border-border object-cover"
                  />
                ))}
              </div>
            )

          case 'specs':
            return (
              <div key={i} className="overflow-hidden rounded-lg border border-border">
                {(block.rows as Array<{ label: string; value: string }>).map((row, k) => (
                  <div
                    key={k}
                    className="flex items-center justify-between gap-4 border-b border-border px-3.5 py-2.5 text-sm last:border-b-0"
                  >
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="text-right font-medium text-foreground">{row.value}</span>
                  </div>
                ))}
              </div>
            )

          case 'callout':
            return (
              <div
                key={i}
                className="rounded-lg border border-border bg-muted/40 px-3.5 py-3 text-sm text-muted-foreground"
              >
                {String(block.text ?? '')}
              </div>
            )

          case 'button':
            return (
              <a
                key={i}
                href={String(block.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center rounded-md bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90"
              >
                {String(block.label)}
              </a>
            )

          case 'divider':
            return <hr key={i} className="border-border" />

          // Bloque desconocido: se ignora. NUNCA romper por un tipo nuevo del servidor.
          default:
            return null
        }
      })}
    </div>
  )
}
