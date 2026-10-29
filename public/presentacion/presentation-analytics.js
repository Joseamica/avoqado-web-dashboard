/* Medición de las presentaciones en línea con PostHog (mismo proyecto que avoqado.io).
   La liga trae ?telefono= (o ?tel=) y ?nombre= para saber quién la abrió. La identidad vive aparte
   (persistence_name propio, sin cookie compartida): un vendedor que abre la liga de un prospecto no
   cambia su propia identidad en el panel ni en la landing. */
(() => {
  // Mismo criterio que la landing (src/lib/priceList.ts): sólo dígitos, los últimos 10.
  // '+52 1 55 1234 5678' · '55-1234-5678' · '55.1234.5678' → '5512345678'; '1234 5678' y '' → null.
  const telefonoDiez = texto => {
    const digitos = String(texto ?? '').replace(/\D/g, '')
    return digitos.length >= 10 ? digitos.slice(-10) : null
  }
  if (typeof window === 'undefined') {
    globalThis.__avqTelefonoDiez = telefonoDiez
    return
  }
  const q = new URLSearchParams(location.search)
  // Sólo producción. ?ph_prueba=1 deja probarlo en una copia local; el tablero filtra por $host.
  if (location.hostname !== 'dashboard.avoqado.io' && q.get('ph_prueba') !== '1') return

  const telefono = telefonoDiez(q.get('telefono') || q.get('tel'))
  const nombre = (q.get('nombre') || '').trim().slice(0, 80)
  const presentacion = location.pathname.split('/').filter(Boolean).pop()?.replace(/\.html$/, '') || 'presentacion'

  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

  window.posthog.init('phc_ywJ2xb3rYnXnaipgNQ6tbqS5pZK8HamLUNo4bUMsingG', {
    api_host: 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    persistence_name: 'avq_presentaciones',
    cross_subdomain_cookie: false,
    // La primera vista se manda a mano, ya con la identidad de la liga.
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: true,
    // Nombre y teléfono escritos o pintados en la página no salen en la grabación.
    session_recording: { maskAllInputs: true, maskTextSelector: '[data-ph-mask]' },
    loaded: ph => {
      try {
        const identificado = ph.get_property('$user_state') === 'identified'
        if (telefono) {
          if (identificado && ph.get_distinct_id() !== telefono) ph.reset()
          ph.identify(telefono, nombre ? { telefono, nombre } : { telefono })
        } else if (nombre) {
          if (identificado) ph.reset()
          ph.setPersonProperties({ nombre })
        }
        ph.register({ presentacion })
        ph.capture('$pageview')
      } catch {
        /* La medición nunca rompe la presentación. */
      }
    },
  })

  const aviso = document.createElement('p')
  aviso.className = 'avq-aviso-medicion no-print'
  aviso.style.cssText = 'margin:0;padding:16px;font-size:12px;color:#6b6f6c;text-align:center'
  aviso.append('Medimos el uso de esta página para mejorar el servicio · ')
  const liga = Object.assign(document.createElement('a'), { href: 'https://avoqado.io/privacy#cookies', target: '_blank', rel: 'noopener', textContent: 'Aviso de privacidad' })
  liga.style.color = 'inherit'
  aviso.append(liga)
  const pintar = () => document.body.append(aviso)
  if (document.body) pintar()
  else document.addEventListener('DOMContentLoaded', pintar)
})()
