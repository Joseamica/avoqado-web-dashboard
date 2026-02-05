# Real-Time (Socket.IO) Guide

The dashboard uses Socket.IO for real-time updates. Auth uses HTTP-only cookies (`withCredentials: true`).

## Room Management

SocketContext automatically joins/leaves venue rooms on venue switch:

```typescript
socket.emit('joinVenueRoom', { venueId })   // on mount / venue change
socket.emit('leaveVenueRoom', { venueId })   // on unmount / venue change
```

## Event Hooks

Use the existing hooks — don't listen to raw socket events directly.

| Hook | Events | Use Case |
|------|--------|----------|
| `useSocketEvents()` | `updateDashboard`, `shiftUpdate` | Dashboard real-time data refresh |
| `usePaymentSocketEvents()` | `payment_initiated`, `payment_processing`, `payment_completed`, `payment_failed` | Payment flow UI |
| `useShiftSocketEvents()` | `shift_opened`, `shift_closed`, `shift_updated` | Shift management |
| `useMenuSocketEvents()` | `menu_updated`, `menu_item_created/updated/deleted`, `product_price_changed`, `menu_item_availability_changed`, `menu_category_updated/deleted` | Menu real-time sync |

## Notification Events

Handled by `NotificationContext` (not a hook):

- `notification_new` — new notification arrived
- `notification:updated` — notification marked read/deleted

## Other Events (page-specific)

| Event | Where Used | Purpose |
|-------|-----------|---------|
| `tpv_status_update` | `TpvId.tsx`, `RemoteCommandPanel.tsx` | Terminal online/offline status |
| `tpv_command_status_changed` | `TpvId.tsx` | Remote command result |
| `subscription.activated` | `Billing.tsx`, `Subscriptions.tsx` | Stripe subscription activated |
| `subscription.deactivated` | `Billing.tsx`, `Subscriptions.tsx` | Stripe subscription cancelled |

## Adding New Events

1. Backend emits event to venue room: `io.to(venueId).emit('event_name', data)`
2. Create a hook in `src/hooks/use-[feature]-socket-events.ts` following existing patterns
3. Hook should accept callback params, subscribe on mount, unsubscribe on unmount
4. Use in the relevant page component
