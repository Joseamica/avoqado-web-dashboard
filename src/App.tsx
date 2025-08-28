// src/App.tsx
import React from 'react'
import { RouterProvider } from 'react-router-dom'

import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

import router from './routes/router'

const App: React.FC = () => {
  return (
    <>
      <RouterProvider router={router} />
      <ReactQueryDevtools initialIsOpen position="bottom" buttonPosition="relative" i18nIsDynamicList={true} styleNonce="nonce" />
    </>
  )
}

export default App
