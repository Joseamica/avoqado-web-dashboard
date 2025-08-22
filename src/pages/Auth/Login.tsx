import React from 'react'
import { Link } from 'react-router-dom'

import Logo from '@/assets/logo'
import CoverLogin from '@/assets/cover-login.png'
import { UserAuthForm } from './components/UserAuthForm'
import { ThemeToggle } from '@/components/ThemeToggle'

const Login: React.FC = () => {
  return (
    <>
      <div className="md:hidden">
        <img src={CoverLogin} width={1280} height={843} alt="Authentication" className="block dark:hidden" />
        <img src={CoverLogin} width={1280} height={843} alt="Authentication" className="hidden dark:block" />
      </div>
      <div
        className={`container relative flex-col items-center justify-center h-screen md:grid lg:max-w-none lg:grid-cols-2 lg:px-0 bg-background text-foreground`}
      >
        <div className="absolute top-4 right-4 md:top-8 md:right-8">
          <ThemeToggle />
        </div>
        <div className="relative flex-col hidden h-full p-10 text-foreground bg-muted dark:border-r lg:flex">
          <div className="absolute inset-0 bg-background" />
          <div className="relative z-20 flex items-center text-lg font-medium">
            <Logo className="w-8 h-8 mr-2" />
            Avoqado
          </div>
          <div className="relative z-20 mt-auto">
            <blockquote className="space-y-2">
              <p className="text-lg">
                &ldquo;This library has saved me countless hours of work and helped me deliver stunning designs to my clients faster than
                ever before.&rdquo;
              </p>
              <footer className="text-sm">Sofia Davis</footer>
            </blockquote>
          </div>
        </div>
        <div className="lg:p-8">
          <div className={`mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px] bg-muted p-6 rounded-xl`}>
            <div className="flex flex-col space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">Iniciar sesión</h1>
              <p className="text-sm text-muted-foreground">Ingresa tu email y contraseña para ingresar.</p>
            </div>
            <UserAuthForm />
            <p className="px-8 text-sm text-center text-muted-foreground">
              Al hacer click en continuar, estas aceptando nuestros{' '}
              <Link to="/terms" className="underline underline-offset-4 hover:text-primary">
                Terminos y condiciones
              </Link>{' '}
              y{' '}
              <Link to="/privacy" className="underline underline-offset-4 hover:text-primary">
                Politicas de privacidad
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

export default Login
