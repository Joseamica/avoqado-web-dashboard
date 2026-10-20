import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PublicDocumentsPage from './PublicDocumentsPage'
import '@/index.css'
import '@/theme.css'

const requestId = window.location.pathname.split('/')[2] || ''
const root = document.getElementById('root')
if (!root) throw new Error('Missing root element')
ReactDOM.createRoot(root).render(
  <QueryClientProvider client={new QueryClient()}>
    <PublicDocumentsPage requestId={requestId} />
  </QueryClientProvider>,
)
