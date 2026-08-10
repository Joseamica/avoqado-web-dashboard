import { Badge } from '@/components/ui/badge'
import { useTranslation } from 'react-i18next'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { CatalogPublicationPreviewField } from '@/features/master-catalog/types'

function displayValue(value: unknown, emptyLabel: string): string {
  if (value === null || value === undefined || value === '') return emptyLabel
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function valuesMatch(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export default function CatalogPreviewTable({ fields }: { fields: CatalogPublicationPreviewField[] }) {
  const { t } = useTranslation('organization')
  const emptyLabel = t('masterCatalog.preview.empty', { defaultValue: 'Vacío' })
  return (
    <Table aria-label={t('masterCatalog.preview.tableLabel', { defaultValue: 'Cambios de la publicación' })}>
      <TableHeader>
        <TableRow>
          <TableHead>{t('masterCatalog.preview.field', { defaultValue: 'Campo' })}</TableHead>
          <TableHead>{t('masterCatalog.preview.before', { defaultValue: 'Antes' })}</TableHead>
          <TableHead>{t('masterCatalog.preview.proposed', { defaultValue: 'Propuesta' })}</TableHead>
          <TableHead>{t('masterCatalog.preview.result', { defaultValue: 'Resultado' })}</TableHead>
          <TableHead>{t('masterCatalog.preview.decision', { defaultValue: 'Decisión' })}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {fields.map(field => (
          <TableRow key={field.field}>
            <TableCell className="font-medium">{field.field}</TableCell>
            <TableCell>{displayValue(field.before, emptyLabel)}</TableCell>
            <TableCell>{displayValue(field.proposed, emptyLabel)}</TableCell>
            <TableCell>
              {valuesMatch(field.before, field.after)
                ? t('masterCatalog.preview.unchanged', { defaultValue: 'Sin cambio' })
                : displayValue(field.after, emptyLabel)}
            </TableCell>
            <TableCell>
              <Badge variant={field.decision === 'UNDECIDED' ? 'destructive' : 'secondary'}>
                {field.decision === 'APPROVE_LOCAL_OVERRIDE'
                  ? t('masterCatalog.preview.overrideApproved', { defaultValue: 'Override aprobado' })
                  : field.decision === 'UNDECIDED'
                    ? t('masterCatalog.preview.undecided', { defaultValue: 'Sin decisión' })
                    : t('masterCatalog.preview.publishCorporate', { defaultValue: 'Publicar corporativo' })}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
