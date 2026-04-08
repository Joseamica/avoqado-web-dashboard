import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { downloadOrgStockExport, type OrgStockOverviewParams } from '@/services/stockDashboard.service'

interface ExportButtonProps {
  orgId: string
  params: OrgStockOverviewParams
}

export function ExportButton({ orgId, params }: ExportButtonProps) {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleClick = async () => {
    setLoading(true)
    try {
      const { blob, filename } = await downloadOrgStockExport(orgId, params)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast({ title: 'Excel descargado', description: filename })
    } catch (err) {
      console.error(err)
      toast({
        title: 'Error al generar Excel',
        description: 'Intenta de nuevo en unos momentos.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={loading}>
      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
      {loading ? 'Generando...' : 'Exportar Excel'}
    </Button>
  )
}
