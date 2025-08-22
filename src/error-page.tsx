import { useRouteError, Link } from 'react-router-dom'

interface ErrorPageProps {
  statusText?: string
  message?: string
  status?: number
}

export default function ErrorPage() {
  const error = useRouteError() as ErrorPageProps | null
  console.error(error)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
      <div className="rounded-lg bg-card p-8 shadow-lg">
        <h1 className="mb-4 text-4xl font-bold text-red-500">Oops!</h1>
        <p className="mb-6 text-lg text-foreground">Sorry, an unexpected error has occurred.</p>
        {error && (error.statusText || error.message) && (
          <p className="mb-6 rounded-md bg-muted p-4 text-muted-foreground">
            <span className="font-medium">{error.status ? `${error.status}: ` : ''}</span>
            <span className="italic">{error.statusText || error.message}</span>
          </p>
        )}
        <Link to="/" className="inline-block rounded-md bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90">
          Back to Home
        </Link>
      </div>
    </div>
  )
}
