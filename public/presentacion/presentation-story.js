/* Mejora progresiva: el documento original queda disponible si esta capa no puede arrancar. */
(() => {
  const root = document.querySelector('.avq-story')
  if (!root) return
  try {
    const data = JSON.parse(document.getElementById('avq-story-data').textContent)
    if (!data.products.length || data.equipment.length !== 6) return
    const productView = root.querySelector('.avq-product-view')
    const equipmentView = root.querySelector('.avq-equipment-view')
    const controls = [...root.querySelectorAll('[data-product]')]
    const cards = [...root.querySelectorAll('[data-hero-product]')]
    const select = root.querySelector('#avq-equipment-select')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const detailURL = id => `${location.pathname.endsWith('avoqado-plataforma.html') ? '' : 'avoqado-plataforma.html'}#${id}`

    function preview(figure, item) {
      const template = root.querySelector(`template[data-preview="${item.preview}"]`)
      figure.replaceChildren(template.content.cloneNode(true))
      const demo = figure.querySelector('.avq-demo')
      const output = demo.querySelector('[data-demo-output]')
      let count = 0
      demo.addEventListener('click', event => {
        const button = event.target.closest('[data-demo-action]')
        if (!button || !demo.contains(button)) return
        const action = button.dataset.demoAction
        if (item.preview === 'pedidos') {
          count = action === 'clear' ? 0 : count + 1
          output.textContent = count ? `${count} ${count === 1 ? 'artículo' : 'artículos'} de ejemplo · pagar al recoger` : 'Tu carrito está vacío'
        } else {
          demo.querySelectorAll('[data-demo-action]').forEach(control => control.setAttribute('aria-pressed', String(control === button)))
          if (item.preview === 'reservas') output.textContent = `Horario de ejemplo: ${action}. No se crea una reserva.`
          if (item.preview === 'dashboard') {
            const rows = { Ventas: ['Actividad', 'Mostrador', 'En línea', 'Reservas'], Inventario: ['Existencias', 'Productos', 'Entradas', 'Movimientos'], Equipo: ['Personal', 'Turnos', 'Permisos', 'Asistencia'] }[action]
            demo.querySelector('[data-demo-column]').textContent = rows[0]
            demo.querySelectorAll('[data-demo-row]').forEach((row, index) => { row.textContent = rows[index + 1] })
            output.textContent = `${rows[0]} del negocio, desde el mismo panel.`
          }
          if (item.preview === 'checkout') {
            const modes = { 'Liga de pago': ['Cobro por liga', 'compártela con tu cliente.'], 'Código QR': ['Cobro por QR', 'tu cliente abre la página de pago.'], 'En tu web': ['Cobro en tu sitio', 'integra el checkout dentro de tu página.'] }
            demo.querySelector('[data-checkout-heading]').textContent = modes[action][0]
            output.textContent = `${action}: ${modes[action][1]}`
          }
        }
      })
    }

    function picture(figure, item) {
      const photo = document.createElement('img')
      photo.className = figure.querySelector('img')?.className || ''
      photo.alt = item.alt
      photo.decoding = 'async'
      photo.hidden = true
      figure.dataset.state = 'loading'
      const status = document.createElement('p')
      status.className = 'avq-story-loading'
      status.setAttribute('role', 'status')
      status.textContent = 'Cargando imagen…'
      const error = document.createElement('p')
      error.className = 'avq-story-image-error'
      const message = document.createElement('span')
      message.textContent = figure.classList.contains('avq-card-image') ? 'No pudimos cargar la imagen.' : 'No pudimos cargar la imagen. Puedes reintentar cuando tengas conexión.'
      error.hidden = true
      const retry = document.createElement('button')
      retry.type = 'button'
      retry.className = 'avq-story-retry'
      retry.textContent = 'Reintentar imagen'
      retry.addEventListener('click', () => {
        picture(figure, item)
        const control = cards.find(button => button.dataset.heroProduct === figure.closest('.avq-product-card')?.dataset.cardProduct)
          || (figure.closest('.avq-equipment-view') ? select : controls.find(button => button.dataset.product === item.id))
        control?.focus({ preventScroll: true })
      })
      error.append(message, retry)
      // Un nodo por selección: una imagen anterior nunca modifica la ficha que llegó después.
      photo.addEventListener('load', () => { photo.hidden = false; status.hidden = true; figure.dataset.state = 'ready' })
      photo.addEventListener('error', () => { status.hidden = true; error.hidden = false; figure.dataset.state = 'error' })
      figure.replaceChildren(photo, status, error)
      photo.src = item.image
    }

    function render(view, item) {
      view.querySelector('h3').textContent = item.title
      view.querySelector('.avq-story-subtitle').textContent = item.subtitle
      const visibleFeatures = view === productView ? item.features.slice(0, 4) : item.features
      const features = visibleFeatures.map(text => {
        const line = document.createElement('li')
        line.textContent = text
        return line
      })
      view.querySelector('ul').replaceChildren(...features)
      view.querySelector('.avq-story-detail').href = detailURL(item.target)
      const figure = view.querySelector('figure')
      figure.classList.toggle('avq-is-demo', !!item.preview)
      if (item.preview) preview(figure, item)
      else picture(figure, item)
      if (!reduced.matches && !root.hidden && typeof view.animate === 'function') {
        view.getAnimations().forEach(animation => animation.cancel())
        view.animate([{ opacity: 0.65, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }],
          { duration: 240, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' })
      }
    }

    function product(id) {
      const item = data.products.find(item => item.id === id)
      if (!item) return
      controls.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.product === id)))
      cards.forEach(button => {
        const selected = button.dataset.heroProduct === id
        button.setAttribute('aria-pressed', String(selected))
        root.querySelector(`[data-card-product="${button.dataset.heroProduct}"]`).classList.toggle('is-current', selected)
      })
      render(productView, item)
    }
    controls.forEach(button => button.addEventListener('click', () => product(button.dataset.product)))
    cards.forEach(button => {
      button.addEventListener('click', () => product(button.dataset.heroProduct))
      root.querySelector(`[data-card-product="${button.dataset.heroProduct}"]`).addEventListener('click', event => {
        if (!event.target.closest('button')) button.click()
      })
    })
    select.addEventListener('change', () => {
      const item = data.equipment.find(item => item.id === select.value)
      if (item) render(equipmentView, item)
    })
    product(data.products[0].id)
    render(equipmentView, data.equipment[0])
    root.querySelectorAll('.avq-card-image').forEach(figure => {
      const photo = figure.querySelector('img')
      picture(figure, { image: photo.getAttribute('src'), alt: photo.alt })
    })
    const cover = document.querySelector('.slide.cover')
    if (cover?.id) {
      root.querySelector('.avq-story-hero').id = cover.id
      cover.removeAttribute('id')
    }
    document.querySelectorAll('.avq-story-nav').forEach(item => { item.hidden = false })
    root.hidden = false
    document.documentElement.classList.add('avq-experience')
  } catch {
    // Ante un arranque incompleto, la presentación y sus controles anteriores siguen visibles.
    root.hidden = true
  }
})()
