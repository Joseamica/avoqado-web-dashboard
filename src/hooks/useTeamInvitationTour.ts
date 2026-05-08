import { driver, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAtomicTourListener } from '@/hooks/useAtomicTourListener'
import { buildFinalStepFooter } from '@/lib/atomic-tour-final-step'

/**
 * Interactive tour for inviting team members.
 *
 * ⚠️ COHERENCIA: Si modificas la UI del Team page (botón de invitar, tabla
 * de miembros, formulario de invitación), actualiza este tour en paralelo —
 * los selectores `data-tour="team-*"` deben seguir apuntando a los elementos
 * descritos en cada paso. Si añades/quitas un campo del formulario de
 * invitación, agrega/quita su step aquí también.
 *
 * Selectores requeridos en el DOM:
 *   - `data-tour="team-invite-btn"` — botón "Invitar miembro" en el header
 *   - `data-tour="team-members-table"` — la tabla de miembros existentes
 *   - `data-tour="team-invite-email"` — input de email en el dialog
 *   - `data-tour="team-invite-role"` — select de rol en el dialog
 *   - `data-tour="team-invite-submit"` — botón "Enviar invitación"
 */

function waitForElement(selector: string, timeout = 4000): Promise<Element | null> {
  return new Promise(resolve => {
    const existing = document.querySelector(selector)
    if (existing) {
      resolve(existing)
      return
    }
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector)
      if (el) {
        observer.disconnect()
        resolve(el)
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    setTimeout(() => {
      observer.disconnect()
      resolve(null)
    }, timeout)
  })
}

const exists = (selector: string): boolean => !!document.querySelector(selector)

export function useTeamInvitationTour() {
  const { t } = useTranslation('team')
  const driverRef = useRef<Driver | null>(null)

  const buildDriver = useCallback((): Driver => {
    const d = driver({
      popoverClass: 'avoqado-tour-popover',
      showProgress: true,
      allowClose: true,
      animate: true,
      overlayOpacity: 0.65,
      stagePadding: 6,
      stageRadius: 8,
      nextBtnText: t('tour.next', { defaultValue: 'Siguiente →' }),
      prevBtnText: t('tour.prev', { defaultValue: '← Anterior' }),
      doneBtnText: t('tour.done', { defaultValue: '¡Listo!' }),
      progressText: t('tour.progress', { defaultValue: 'Paso {{current}} de {{total}}' }),
      onDestroyed: () => {
        document.body.classList.remove('tour-active')
      },
      steps: [
        {
          popover: {
            title: t('tour.welcome.title', { defaultValue: '👥 Invita a tu equipo' }),
            description: t('tour.welcome.description', {
              defaultValue:
                'Te voy a guiar para que invites a tu primer miembro. Cada persona puede tener un rol distinto (Mesero, Cajero, Gerente…) y el sistema controla qué puede ver y hacer.',
            }),
          },
        },
        {
          element: '[data-tour="team-invite-btn"]',
          popover: {
            title: t('tour.invite.title', { defaultValue: 'Botón "Invitar miembro"' }),
            description: t('tour.invite.description', {
              defaultValue:
                'Haz clic aquí para abrir el formulario. Le mandamos un correo a la persona con el link para crear su cuenta y entrar a tu negocio.',
            }),
            side: 'bottom',
            align: 'end',
            onNextClick: async () => {
              if (!exists('[data-tour="team-invite-email"]')) {
                document.querySelector<HTMLButtonElement>('[data-tour="team-invite-btn"]')?.click()
                await waitForElement('[data-tour="team-invite-email"]', 3000)
              }
              d.moveNext()
            },
          },
        },
        {
          element: '[data-tour="team-invite-email"]',
          popover: {
            title: t('tour.email.title', { defaultValue: 'Correo del invitado' }),
            description: t('tour.email.description', {
              defaultValue:
                'Escribe el correo de la persona. Le llegará un email con el link para aceptar la invitación.',
            }),
            side: 'bottom',
            align: 'start',
          },
        },
        {
          element: '[data-tour="team-invite-role"]',
          popover: {
            title: t('tour.role.title', { defaultValue: 'Asigna un rol' }),
            description: t('tour.role.description', {
              defaultValue:
                'El rol controla los permisos: <b>Mesero</b> toma órdenes y cobra; <b>Gerente</b> ve reportes; <b>Admin</b> configura el negocio. Puedes cambiarlo después.',
            }),
            side: 'bottom',
            align: 'start',
          },
        },
        {
          element: '[data-tour="team-invite-submit"]',
          popover: {
            title: t('tour.submit.title', { defaultValue: 'Enviar invitación' }),
            description: t('tour.submit.description', {
              defaultValue:
                'Listo. Cuando la persona acepte, aparecerá en tu tabla de miembros y podrá entrar al dashboard con sus permisos.',
            }),
            side: 'top',
            align: 'end',
            ...buildFinalStepFooter({
              tourName: 'team-invitation',
              cancelLabel: t('tour.cancel', { defaultValue: 'Cancelar' }),
              doneLabel: t('tour.done', { defaultValue: '¡Listo!' }),
              homeLabel: t('tour.backToHome', { defaultValue: 'Volver a inicio' }),
            }),
          },
        },
      ],
    })
    return d
  }, [t])

  const start = useCallback(() => {
    document.body.classList.add('tour-active')
    driverRef.current?.destroy()
    driverRef.current = buildDriver()
    driverRef.current.drive()
  }, [buildDriver])

  useAtomicTourListener('team-invitation', start)

  useEffect(() => {
    return () => {
      driverRef.current?.destroy()
      driverRef.current = null
      document.body.classList.remove('tour-active')
    }
  }, [])

  return { start }
}
