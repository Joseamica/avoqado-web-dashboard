// src/App.tsx
import React from 'react'
import { RouterProvider } from 'react-router-dom'

import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

// import { EnvironmentIndicator } from './components/EnvironmentIndicator'
import router from './routes/router'

const App: React.FC = () => {
  return (
    <>
      {/* <EnvironmentIndicator /> */}
      <RouterProvider router={router} />
      <ReactQueryDevtools initialIsOpen position="bottom" buttonPosition="bottom-left" i18nIsDynamicList={true} styleNonce="nonce" />
    </>
  )
}

export default App
// cors preview test Mon Feb  9 14:20:01 CST 2026
