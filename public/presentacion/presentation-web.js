/* Capa web: el texto original sigue en el documento y se conserva al imprimir. */
(() => {
  const data = JSON.parse(document.getElementById('avq-features').textContent)
  const dialog = document.querySelector('.avq-dialog')
  const content = dialog.querySelector('.avq-dialog-content')
  const title = dialog.querySelector('h2')
  const terminalPage = document.body.classList.contains('avq-terminal-page')
  let trigger
  const close = () => dialog.close()
  dialog.querySelector('.avq-close').addEventListener('click', close)
  dialog.addEventListener('close', () => { content.replaceChildren(); trigger?.focus({ preventScroll: true }) })
  dialog.addEventListener('click', event => {
    const box = dialog.getBoundingClientRect()
    if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) close()
  })
  function open(button, heading, description, image) {
    trigger = button
    title.textContent = heading
    content.replaceChildren()
    if (image) {
      const photo = document.createElement('img')
      photo.alt = heading
      photo.hidden = true
      const loading = document.createElement('p')
      loading.setAttribute('role', 'status')
      loading.textContent = 'Cargando imagen…'
      const error = document.createElement('p')
      error.className = 'avq-image-error'
      error.textContent = 'No pudimos cargar la imagen. Cierra y vuelve a intentarlo cuando tengas conexión.'
      error.hidden = true
      photo.addEventListener('load', () => { photo.hidden = false; loading.hidden = true })
      photo.addEventListener('error', () => { loading.hidden = true; error.hidden = false })
      photo.src = image.currentSrc || image.src
      content.append(photo, loading, error)
    }
    if (description) {
      const text = document.createElement('p')
      text.textContent = description
      content.append(text)
    }
    dialog.showModal()
  }
  if (typeof dialog.showModal === 'function') {
    const aliases = { ERP: 'Inventario', CRM: 'Clientes y lealtad', BI: 'Analítica', CFDI: 'CFDI 4.0', Reservas: 'Reservaciones' }
    const terms = document.documentElement.classList.contains('avq-experience')
      ? document.querySelectorAll('.avq-story-hero .formula .c')
      : document.querySelectorAll('.page .formula .c, .slide.cover .formula .fc')
    terms.forEach(term => {
      const label = term.textContent.trim()
      const feature = data.find(item => item.label === (aliases[label] || label) || item.label.startsWith(`${aliases[label] || label} (`))
      if (!feature) return
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'avq-term avq-screen-only'
      button.append(term.cloneNode(true))
      button.setAttribute('aria-label', `${label}: ver explicación`)
      button.setAttribute('aria-haspopup', 'dialog')
      button.addEventListener('click', () => open(button, label, feature.description))
      term.classList.add('avq-print-only')
      term.after(button)
    })
    document.querySelectorAll('.hwph img, .hwl .im img, .pmedia img, .avq-terminal-page main img:not([alt="Avoqado"]):not([src="assets/qr-wa.png"])').forEach(image => {
      if (image.closest('a, button')) return
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'avq-zoom'
      button.setAttribute('aria-label', `Ampliar ${image.alt || 'imagen'}`)
      button.setAttribute('aria-haspopup', 'dialog')
      image.before(button)
      button.append(image)
      if (terminalPage) {
        const loading = document.createElement('p')
        loading.className = 'avq-photo-state avq-screen-only'
        loading.setAttribute('role', 'status')
        loading.textContent = 'Cargando imagen…'
        const error = document.createElement('div')
        error.className = 'avq-photo-state avq-screen-only'
        error.append('No pudimos cargar la imagen.')
        error.hidden = true
        const retry = document.createElement('button')
        retry.type = 'button'
        retry.textContent = 'Reintentar imagen'
        retry.addEventListener('click', () => {
          error.hidden = true
          loading.hidden = false
          image.src = image.src
          const control = document.querySelector(`[data-terminal-select="${image.closest('[data-terminal-id]')?.dataset.terminalId}"]`)
          const focusTarget = control || document.querySelector('.avq-brand')
          focusTarget.focus({ preventScroll: true })
        })
        error.append(retry)
        button.after(loading, error)
        const ready = () => { button.hidden = false; loading.hidden = true; error.hidden = true }
        const failed = () => { button.hidden = true; loading.hidden = true; error.hidden = false }
        image.addEventListener('load', ready)
        image.addEventListener('error', failed)
        button.hidden = true
        if (image.complete && image.naturalWidth) ready()
        else if (image.complete) failed()
        // Las fotos dentro de un botón oculto no pueden depender de lazy loading.
        image.removeAttribute('loading')
      }
      button.addEventListener('click', () => {
        const card = button.closest('.hw .card, .hwl .it')
        const heading = card?.querySelector('.hwn, .tn')?.textContent || image.alt || 'Imagen de Avoqado'
        const description = card ? [...card.querySelectorAll('.hws, .feat, .hwp, .ts, .tv, .pr')].map(el => el.textContent.trim()).join(' · ') : ''
        open(button, heading, description, image)
      })
    })
  }
  document.querySelectorAll('.chips').forEach(chips => {
    if (terminalPage) return
    const list = document.createElement('div')
    list.className = 'avq-feature-list avq-screen-only'
    chips.querySelectorAll('.chip').forEach(chip => {
      const heading = chip.querySelector('b')
      if (!heading) return
      const detail = document.createElement('details')
      detail.className = 'avq-feature'
      const summary = document.createElement('summary')
      summary.textContent = heading.textContent
      const statuses = [...new Set(chip.textContent.match(/\b(?:Premium|Pro|ya disponible|próximamente|piloto|próxima fase)\b/gi) || [])]
      statuses.filter(status => !heading.textContent.toLowerCase().includes(status.toLowerCase())).forEach(status => {
        const badge = document.createElement('span')
        badge.className = 'avq-status'
        const labels = { Pro: 'Funciones Pro', Premium: 'Funciones Premium', piloto: 'Incluye un piloto', 'próxima fase': 'Incluye una próxima fase', 'ya disponible': 'Ya disponible' }
        badge.textContent = labels[status] || status
        summary.append(badge)
      })
      const body = document.createElement('p')
      body.textContent = chip.textContent.slice(heading.textContent.length).replace(/^[\s·—-]+/, '')
      detail.append(summary, body)
      list.append(detail)
    })
    chips.after(list)
    chips.classList.add('avq-print-only')
  })
  document.querySelectorAll('.avq-index a').forEach(link => {
    link.addEventListener('click', () => { link.closest('details').open = false })
  })
  document.documentElement.classList.add('avq-enhanced')
})()
