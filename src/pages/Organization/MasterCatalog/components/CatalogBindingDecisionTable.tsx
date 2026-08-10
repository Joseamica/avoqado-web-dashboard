import { Badge } from '@/components/ui/badge'
import { useTranslation } from 'react-i18next'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { CatalogBindingPreviewLine } from '@/features/master-catalog/types'

export default function CatalogBindingDecisionTable({ lines }: { lines: CatalogBindingPreviewLine[] }) {
  const { t } = useTranslation('organization')
  return (
    <Table aria-label={t('masterCatalog.bindings.tableLabel', { defaultValue: 'Propuestas de asignación' })}>
      <TableHeader>
        <TableRow>
          <TableHead>{t('masterCatalog.columns.item', { defaultValue: 'Artículo' })}</TableHead>
          <TableHead>{t('masterCatalog.columns.venue', { defaultValue: 'Sucursal' })}</TableHead>
          <TableHead>{t('masterCatalog.preview.proposed', { defaultValue: 'Propuesta' })}</TableHead>
          <TableHead>{t('masterCatalog.columns.status', { defaultValue: 'Estado' })}</TableHead>
          <TableHead>{t('masterCatalog.columns.detail', { defaultValue: 'Detalle' })}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map(line => (
          <TableRow key={`${line.catalogItemId}-${line.venueId}`}>
            <TableCell className="font-mono text-xs">{line.catalogItemId}</TableCell>
            <TableCell className="font-mono text-xs">{line.venueId}</TableCell>
            <TableCell>
              <Badge variant="secondary">{line.proposal}</Badge>
            </TableCell>
            <TableCell>{line.status}</TableCell>
            <TableCell className={line.errorCode ? 'text-destructive' : 'text-muted-foreground'}>
              {line.errorCode ?? line.readiness}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
