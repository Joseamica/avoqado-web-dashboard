import '@testing-library/jest-dom'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { setupServer } from 'msw/node'
import { handlers } from './mocks/handlers'

// Setup MSW server for API mocking
export const server = setupServer(...handlers)

// Start server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))

// Reset handlers after each test
afterEach(() => server.resetHandlers())

// Clean up after all tests
afterAll(() => server.close())

// Mock window.matchMedia
//
// Función real, NO `vi.fn().mockImplementation(...)`, por el MISMO motivo que el
// ResizeObserver de abajo: la config tiene `mockReset: true`, que borra la implementación
// de cualquier vi.fn() antes de cada test. Con el mock reseteado, `window.matchMedia(...)`
// devolvía `undefined` y todo componente que use `useIsMobile` (o el Sidebar) tronaba con
// "Cannot read properties of undefined (reading 'addEventListener')".
//
// El defecto ya se había sufrido: `SalesDetail.sinEvidencia.test.tsx` lo parchea a mano en
// su propio `beforeEach`, con un comentario explicando la causa. Ese parche sigue siendo
// inocuo (redefine lo mismo), pero ya no es necesario.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

// Mock ResizeObserver
//
// Clase real, NO `vi.fn().mockImplementation(...)`: la config tiene `mockReset: true`,
// que borra la implementación de cualquier vi.fn() antes de cada test. Con un mock
// reseteado, `new ResizeObserver()` devolvía un objeto vacío y todo componente que
// use Radix Popper (Select, Popover, Tooltip…) tronaba con
// "resizeObserver.observe is not a function".
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn()

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })
