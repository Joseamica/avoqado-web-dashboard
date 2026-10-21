/* Selecciones ilustrativas locales: no se consulta ni se escribe una venta. */
(() => {
  const root = document.querySelector('.avq-terminal')
  if (!root) return
  const data = JSON.parse(document.getElementById('avq-terminal-data').textContent)
  const controls = [...root.querySelectorAll('[data-terminal-select]')]
  function select(id) {
    controls.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.terminalSelect === id)))
    root.querySelectorAll('[data-terminal-profile]').forEach(profile => { profile.hidden = profile.dataset.terminalProfile !== id })
    root.querySelectorAll('[data-terminal-id]').forEach(photo => photo.classList.toggle('is-current', photo.dataset.terminalId === id))
  }
  controls.forEach(button => button.addEventListener('click', () => select(button.dataset.terminalSelect)))
  const accounts = [...root.querySelectorAll('[data-terminal-account]')]
  function account(index) {
    accounts.forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.terminalAccount) === index)))
    const item = data.accounts[index]
    root.querySelector('[data-terminal-output]').textContent = `En este ejemplo: ${item.destination} (${item.bank}). No se envía dinero.`
  }
  accounts.forEach(button => button.addEventListener('click', () => account(Number(button.dataset.terminalAccount))))
  select(data.equipment[0].id)
  account(0)
  root.hidden = false
  document.querySelectorAll('.avq-story-nav').forEach(item => { item.hidden = false })
  document.documentElement.classList.add('avq-terminal-ready')
})()
