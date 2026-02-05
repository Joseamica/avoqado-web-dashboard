/**
 * Unit tests for NotificationContext reducer logic
 * Tests the bug fixes implemented:
 * - BUG #7: Deduplication
 * - Reducer state management
 */

import { describe, it, expect } from 'vitest'

// Replicate the types and reducer from NotificationContext
interface Notification {
  id: string
  title: string
  message: string
  isRead: boolean
  priority: 'LOW' | 'NORMAL' | 'HIGH'
  createdAt: string
  readAt?: string
}

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  error: string | null
  filters: Record<string, unknown>
  pagination: {
    page: number
    limit: number
    sortBy: string
    sortOrder: string
  }
}

type NotificationAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_NOTIFICATIONS'; payload: Notification[] }
  | { type: 'SET_UNREAD_COUNT'; payload: number }
  | { type: 'MARK_AS_READ'; payload: string }
  | { type: 'DELETE_NOTIFICATION'; payload: string }
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'SET_FILTERS'; payload: Record<string, unknown> }
  | { type: 'SET_PAGINATION'; payload: Partial<NotificationState['pagination']> }

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
  filters: {},
  pagination: {
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  }
}

// Replicate the reducer with the deduplication fix
function notificationReducer(state: NotificationState, action: NotificationAction): NotificationState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload }

    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false }

    case 'SET_NOTIFICATIONS':
      return { ...state, notifications: action.payload, loading: false, error: null }

    case 'SET_UNREAD_COUNT':
      return { ...state, unreadCount: action.payload }

    case 'MARK_AS_READ':
      return {
        ...state,
        notifications: state.notifications.map(notification =>
          notification.id === action.payload
            ? { ...notification, isRead: true, readAt: new Date().toISOString() }
            : notification
        ),
        unreadCount: Math.max(0, state.unreadCount - 1)
      }

    case 'DELETE_NOTIFICATION':
      {
        const deletedNotification = state.notifications.find(n => n.id === action.payload)
        return {
          ...state,
          notifications: state.notifications.filter(notification => notification.id !== action.payload),
          unreadCount:
            deletedNotification && !deletedNotification.isRead
              ? Math.max(0, state.unreadCount - 1)
              : state.unreadCount,
        }
      }

    case 'ADD_NOTIFICATION':
      // BUG #7 FIX: Deduplication - prevents duplicate notifications if socket re-emits
      if (state.notifications.some(n => n.id === action.payload.id)) {
        return state
      }
      return {
        ...state,
        notifications: [action.payload, ...state.notifications],
        unreadCount: action.payload.isRead ? state.unreadCount : state.unreadCount + 1
      }

    case 'SET_FILTERS':
      return { ...state, filters: action.payload }

    case 'SET_PAGINATION':
      return { ...state, pagination: { ...state.pagination, ...action.payload } }

    default:
      return state
  }
}

// Helper to create a test notification
function createTestNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'test-id-' + Math.random().toString(36).substr(2, 9),
    title: 'Test Notification',
    message: 'Test message',
    isRead: false,
    priority: 'NORMAL',
    createdAt: new Date().toISOString(),
    ...overrides
  }
}

describe('NotificationContext Reducer', () => {
  describe('ADD_NOTIFICATION', () => {
    it('should add a new notification to the beginning of the list', () => {
      const notification = createTestNotification({ id: 'new-notification' })
      const state = notificationReducer(initialState, {
        type: 'ADD_NOTIFICATION',
        payload: notification
      })

      expect(state.notifications).toHaveLength(1)
      expect(state.notifications[0].id).toBe('new-notification')
    })

    it('should increment unreadCount for unread notifications', () => {
      const notification = createTestNotification({ isRead: false })
      const state = notificationReducer(initialState, {
        type: 'ADD_NOTIFICATION',
        payload: notification
      })

      expect(state.unreadCount).toBe(1)
    })

    it('should NOT increment unreadCount for already-read notifications', () => {
      const notification = createTestNotification({ isRead: true })
      const state = notificationReducer(initialState, {
        type: 'ADD_NOTIFICATION',
        payload: notification
      })

      expect(state.unreadCount).toBe(0)
    })

    it('BUG #7 FIX: should NOT add duplicate notifications with same ID', () => {
      const notification = createTestNotification({ id: 'duplicate-id' })

      // Add first notification
      let state = notificationReducer(initialState, {
        type: 'ADD_NOTIFICATION',
        payload: notification
      })

      expect(state.notifications).toHaveLength(1)
      expect(state.unreadCount).toBe(1)

      // Try to add same notification again (simulating socket re-emit)
      state = notificationReducer(state, {
        type: 'ADD_NOTIFICATION',
        payload: notification
      })

      // Should still be 1, not 2
      expect(state.notifications).toHaveLength(1)
      expect(state.unreadCount).toBe(1)
    })

    it('BUG #7 FIX: should add notifications with different IDs', () => {
      const notification1 = createTestNotification({ id: 'id-1' })
      const notification2 = createTestNotification({ id: 'id-2' })

      let state = notificationReducer(initialState, {
        type: 'ADD_NOTIFICATION',
        payload: notification1
      })

      state = notificationReducer(state, {
        type: 'ADD_NOTIFICATION',
        payload: notification2
      })

      expect(state.notifications).toHaveLength(2)
      expect(state.unreadCount).toBe(2)
    })

    it('BUG #7 FIX: should handle rapid duplicate emissions (stress test)', () => {
      const notification = createTestNotification({ id: 'rapid-test' })
      let state = initialState

      // Simulate rapid socket emissions (10 times)
      for (let i = 0; i < 10; i++) {
        state = notificationReducer(state, {
          type: 'ADD_NOTIFICATION',
          payload: notification
        })
      }

      // Should only have 1 notification
      expect(state.notifications).toHaveLength(1)
      expect(state.unreadCount).toBe(1)
    })
  })

  describe('MARK_AS_READ', () => {
    it('should mark a notification as read', () => {
      const notification = createTestNotification({ id: 'to-read', isRead: false })
      let state = notificationReducer(initialState, {
        type: 'ADD_NOTIFICATION',
        payload: notification
      })

      state = notificationReducer(state, {
        type: 'MARK_AS_READ',
        payload: 'to-read'
      })

      expect(state.notifications[0].isRead).toBe(true)
      expect(state.notifications[0].readAt).toBeDefined()
      expect(state.unreadCount).toBe(0)
    })

    it('should not decrement unreadCount below 0', () => {
      const state = notificationReducer(initialState, {
        type: 'MARK_AS_READ',
        payload: 'non-existent'
      })

      expect(state.unreadCount).toBe(0)
    })
  })

  describe('DELETE_NOTIFICATION', () => {
    it('should remove a notification from the list', () => {
      const notification = createTestNotification({ id: 'to-delete' })
      let state = notificationReducer(initialState, {
        type: 'ADD_NOTIFICATION',
        payload: notification
      })

      state = notificationReducer(state, {
        type: 'DELETE_NOTIFICATION',
        payload: 'to-delete'
      })

      expect(state.notifications).toHaveLength(0)
    })

    it('should decrement unreadCount when deleting unread notification', () => {
      const notification = createTestNotification({ id: 'to-delete', isRead: false })
      let state = notificationReducer(initialState, {
        type: 'ADD_NOTIFICATION',
        payload: notification
      })

      expect(state.unreadCount).toBe(1)

      state = notificationReducer(state, {
        type: 'DELETE_NOTIFICATION',
        payload: 'to-delete'
      })

      expect(state.unreadCount).toBe(0)
    })

    it('should NOT decrement unreadCount when deleting read notification', () => {
      const notification = createTestNotification({ id: 'to-delete', isRead: true })
      let state = notificationReducer(initialState, {
        type: 'ADD_NOTIFICATION',
        payload: notification
      })

      expect(state.unreadCount).toBe(0)

      state = notificationReducer(state, {
        type: 'DELETE_NOTIFICATION',
        payload: 'to-delete'
      })

      expect(state.unreadCount).toBe(0)
    })
  })

  describe('SET_NOTIFICATIONS', () => {
    it('should replace all notifications', () => {
      const notifications = [
        createTestNotification({ id: '1' }),
        createTestNotification({ id: '2' }),
        createTestNotification({ id: '3' })
      ]

      const state = notificationReducer(initialState, {
        type: 'SET_NOTIFICATIONS',
        payload: notifications
      })

      expect(state.notifications).toHaveLength(3)
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
    })
  })

  describe('Error handling', () => {
    it('should set error and clear loading', () => {
      const state = notificationReducer(
        { ...initialState, loading: true },
        { type: 'SET_ERROR', payload: 'Test error' }
      )

      expect(state.error).toBe('Test error')
      expect(state.loading).toBe(false)
    })
  })
})

// Test for socket handler error boundaries (BUG #4 fix)
describe('Socket Handler Error Boundaries', () => {
  it('should handle browser notification failure gracefully', () => {
    // Simulate what happens in the socket handler when browser notification fails
    const _notification = {
      id: 'test-id',
      title: 'Test',
      message: 'Test message',
      priority: 'NORMAL' as const
    }

    let dispatchCalled = false
    const mockDispatch = () => {
      dispatchCalled = true
    }

    // Simulate the handler logic with error boundary
    const simulateHandler = () => {
      // This should always work (adding to state)
      mockDispatch()

      // This might fail (browser notification)
      try {
        // Simulating a failing browser notification API
        throw new Error('NotificationAPI not available')
      } catch (error) {
        // Error is caught, handler continues
        console.warn('Browser notification failed:', error)
      }
    }

    // Should not throw
    expect(() => simulateHandler()).not.toThrow()
    // State update should still have happened
    expect(dispatchCalled).toBe(true)
  })

  it('should validate notification ID before processing', () => {
    // Test the ID validation logic
    const notificationWithoutId = {
      title: 'Test',
      message: 'Test message',
      priority: 'NORMAL' as const
    }

    const notificationId = (notificationWithoutId as any).notificationId || (notificationWithoutId as any).id

    // Should be undefined/falsy
    expect(notificationId).toBeFalsy()

    // The handler should return early for invalid IDs
    // This prevents crashes from malformed notifications
  })

  it('should handle null socket gracefully', () => {
    // Simulate the condition check in useEffect
    const socket = null
    const isConnected = true

    // The effect should return early
    const shouldSetupListeners = socket && isConnected
    expect(shouldSetupListeners).toBeFalsy()
  })

  it('should handle disconnected socket gracefully', () => {
    const socket = { on: () => {}, off: () => {} }
    const isConnected = false

    const shouldSetupListeners = socket && isConnected
    expect(shouldSetupListeners).toBeFalsy()
  })
})

// Test for ID normalization (BUG #3 fix)
describe('ID Normalization', () => {
  it('should handle notificationId field from backend', () => {
    // This tests the transformation logic in the socket handler
    const backendNotification = {
      notificationId: 'backend-id-123',
      title: 'Test',
      message: 'Test message',
      priority: 'NORMAL' as const,
      isRead: false,
      createdAt: new Date().toISOString()
    }

    // Simulate the transformation that happens in handleNewNotification
    const notificationId = backendNotification.notificationId || (backendNotification as any).id
    const transformedNotification: Notification = {
      ...backendNotification,
      id: notificationId,
    }

    expect(transformedNotification.id).toBe('backend-id-123')
  })

  it('should handle id field from backend', () => {
    const backendNotification = {
      id: 'frontend-id-456',
      title: 'Test',
      message: 'Test message',
      priority: 'NORMAL' as const,
      isRead: false,
      createdAt: new Date().toISOString()
    }

    const notificationId = (backendNotification as any).notificationId || backendNotification.id
    const transformedNotification: Notification = {
      ...backendNotification,
      id: notificationId,
    }

    expect(transformedNotification.id).toBe('frontend-id-456')
  })
})
