import { useRouteError, Link } from 'react-router-dom'

interface ErrorPageProps {
  statusText?: string
  message?: string
  status?: number
}

export default function ErrorPage() {
  const error = useRouteError() as ErrorPageProps
  console.error(error)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 text-center">
      <div className="rounded-lg bg-white p-8 shadow-lg">
        <h1 className="mb-4 text-4xl font-bold text-red-500">Oops!</h1>
        <p className="mb-6 text-lg text-gray-700">Sorry, an unexpected error has occurred.</p>
        {(error.statusText || error.message) && (
          <p className="mb-6 rounded-md bg-gray-100 p-4 text-gray-600">
            <span className="font-medium">{error.status ? `${error.status}: ` : ''}</span>
            <span className="italic">{error.statusText || error.message}</span>
          </p>
        )}
        <Link to="/" className="inline-block rounded-md bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600">
          Back to Home
        </Link>
      </div>
    </div>
  )
}
