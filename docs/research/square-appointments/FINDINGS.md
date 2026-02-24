# Square Appointments Dashboard — UX Research Findings

**Date**: 2026-02-23
**Source**: Live exploration of `app.squareup.com/dashboard/appointments` (Square Plus trial)

---

## 1. Sidebar Navigation Structure

Square uses a **dedicated sub-sidebar** within the main Square Dashboard for the Appointments module. When you enter Appointments, the main Square sidebar collapses and is replaced by an Appointments-specific sidebar.

### Sidebar Items (top to bottom):

```
← Appointments          (back arrow + module title)
─────────────────────
Overview                (flat link)
Calendar                (flat link)
Waitlist                (flat link)
Online booking    ▾     (collapsible group)
  ├─ Channels
  ├─ Settings
  ├─ Advanced widget
  └─ Invite clients
Settings          ▾     (collapsible group)
  ├─ Calendar & booking
  ├─ Payments & cancellations
  ├─ Communications
  └─ History
─────────────────────
[Take payment]          (bottom action button)
🔔 💬 ❓ ✨             (notifications, messages, help, AI)
```

### Key Observations:
- **3 flat top-level items**: Overview, Calendar, Waitlist
- **2 collapsible groups**: Online booking (4 sub-items), Settings (4 sub-items)
- Collapsible groups use **chevron** (▾/▴) to indicate expand/collapse
- Active item has a **left border accent** + **slightly darker background**
- Sub-items are **indented** under their parent
- The **back arrow** (`←`) returns to the main Square Dashboard
- **No icons** on individual nav items — only text labels
- **Search bar** at the very top of the sidebar

---

## 2. Overview Page (Dashboard)

**URL**: `/dashboard/appointments`

### Layout:
- **Setup guide** (onboarding wizard): progress bar (30%), collapsible sections
  - Primary setup: Take payments, Set up location, Create services
  - Advanced setup: (collapsed)
- **Upcoming appointments**: table showing next appointments, timezone display (CST)
- **Notifications**: panel showing recent changes to appointments

### Key UX:
- "Hide setup guide" button in top-right
- Each setup item is dismissible (X button)
- Clean two-column layout below setup: appointments left, notifications right

---

## 3. Calendar Page

**URL**: `/dashboard/appointments/calendar`

### Header Controls:
- **Date navigator**: `← Feb 22 – Feb 28 →` with Previous/Next week buttons
- **Range selector**: "Range: Week" button (supports day/week switching)
- **Action buttons** (top-right): More (⋯), Appointment attributes, Edit availability, **Create** (black filled button)

### Calendar Grid:
- **Week view**: Sun–Sat columns, time axis 1 AM – 11 PM
- **Day headers**: `Sun 02/22`, `Mon 02/23`, etc.
- **"All day"** row at top for all-day events
- **Current time indicator**: red horizontal line on today's column
- **Gray shading** on non-business-hour cells (unavailable times)
- Grid cells are clickable to create appointments

### Key UX:
- **Create button** opens a **full-screen dialog** (not a small modal)
- Date range quick jumps: Today, In 1 week, In 2 weeks... up to In 6 weeks
- "Edit availability" button for managing business hours

---

## 4. Create Appointment Flow (Full-Screen Dialog)

**URL**: `/dashboard/appointments/appointments/new?skipBlade=false`

### Dialog Structure:
- **Header**: X close (top-left) | ⋯ Actions + **Save** (top-right, black filled)
- **Title**: "Create appointment" (h2, below header)
- **Two-column layout**: Form (left ~65%) + Customer sidebar (right ~35%)

### Form Fields:
1. **Event type**: Dropdown (Appointment/other types)
2. **Customer**: Combobox with search
3. **Services and items**:
   - "Add services" combobox
   - "Add item" and "Add discount" buttons
   - Subtotal / Total display
4. **Date and time**:
   - Repeat toggle (switch)
   - All day toggle (switch)
   - Date input + Time input (side by side)
5. **Notes**: Textarea ("Appointment notes" — staff-only, optional)

### Customer Sidebar:
- Shows "No customer selected" when empty
- "Select a customer to view their details"
- When customer selected: shows customer profile, history, etc.

### Key UX Patterns:
- **Full-screen takeover** — hides sidebar and calendar completely
- **No multi-step wizard** — single scrollable form
- **Save button in header** — always visible, not at form bottom
- **Actions menu** (⋯) for additional options
- Pre-fills date/time to current time when opened from calendar

---

## 5. Waitlist Page

**URL**: `/dashboard/appointments/waitlist`

### Layout:
- **Title**: "Waitlist" with star icon (premium feature indicator)
- **Add request** button (top-right, black filled)
- **Info banner**: "Introducing: Automated notifications" — auto-notify clients when matching availability opens
- **Empty state**: "No waitlist requests" + explanation + link to Online Booking Settings
- **Feature callout tooltip**: "New: Capture multiple date and time preferences per client"

### Key UX:
- Waitlist is linked to Online Booking — clients join via online booking site
- Settings for waitlist are in Online Booking Settings, not a separate page
- Premium features marked with blue star icon

---

## 6. Online Booking Section

### 6a. Channels (`/booking/channels`)
- **CTA page**: "Get booked online" with mobile mockup screenshots
- Shows 3 phone screens: service list, service detail, calendar picker
- "Enable online booking" button (black, centered)
- "Learn how to optimize your site" link

### 6b. Settings (`/booking/settings`)
- Same "Enable online booking" CTA (must enable first to configure)
- Shows Google, Instagram, Square Online icons

### 6c. Advanced Widget (`/booking/advanced`)
- Same "Enable online booking" CTA
- This is for embeddable widget code (HTML embed for external websites)

### 6d. Invite Clients (`/booking/invite`)
- Send booking links to clients

---

## 7. Settings Section

### 7a. Calendar & Booking (`/business/settings`)

**Sections (full page scroll):**

1. **Appointment preferences**
   - Where do you accept appointments? (radio: At my business / Customer's location / Both / Phone only)

2. **Online booking preferences**
   - Reservation guarantee (radio: Auto-accept all / Must accept or decline)
   - Customer booking timezone (radio: Allow customer choice / Lock to business timezone)

3. **Waitlist** (star = premium)
   - Enable waitlist on online booking site (toggle)
   - Send notification when opening occurs (toggle)

4. **Marketing opt-in**
   - Allow text message marketing opt-in (toggle)

5. **Customer profile fields** (star = premium)
   - Add custom field (when booking appointment / when booking class)

6. **Online scheduling**
   - Appointments scheduled at: 30 minute intervals (dropdown)
   - Must be made in advance: None (dropdown)
   - Can't be scheduled farther than: 365 days (dropdown)
   - Client reschedule/cancel: moved to Payments & cancellations
   - Allow multiple services online (toggle, on)
   - Remove team members from booking site (toggle)
   - Daily appointment limit (toggle, star = premium)

7. **Manage calendar sync**
   - Link Google Calendar

8. **Fake-it filter**
   - Reduce availability to appear busier (dropdown: Off)

**Footer**: Cancel + Save buttons (sticky bottom bar)

### 7b. Payments & Cancellations (`/business/cancellation_policy`)

1. **Payments**
   - "Protect against no-shows and late cancellations"
   - Options: No requirements / Deposit / Full payment / Card hold
   - Afterpay for online booking

2. **Cancellation policy**
   - Cut-off time: None (configurable)
   - Policy text: customizable
   - Client self-reschedule/cancel before cut-off (toggle, on)
   - Note: "Clients cannot cancel appointments that are prepaid or charged a deposit"

### 7c. Communications (`/business/client_relations`)

1. **Confirmations and Reminders**
   - Send confirmation request (toggle, on)
   - Confirmation method: Text Message (dropdown)
   - When: 2 days prior (dropdown)

2. **Reminders**
   - SMS reminder (toggle, on) — When: 1 hour prior
   - Email reminder (toggle, on) — When: 1 day prior

3. **Square Assistant**
   - AI-powered: clients confirm/cancel/change by replying to SMS (toggle, on)

4. **Forms** (digital contracts)
   - Add form via Square Contracts

5. **Preferred business language** (localization)

6. **Customizable email/SMS templates** (expandable rows):
   - New appointments: Client requested, Business accepted, Accepted with changes, Business declined
   - Confirmation & reminders: Confirmation request, Reminder, Reminder with confirmation
   - Appointment changes: Business changed, Business rescheduled, Client rescheduled, Client requested reschedule, Accepted reschedule with changes, Declined reschedule
   - Appointment cancellations: Business cancelled, No-show, Client cancelled

### 7d. History (`/business/history`)
- **Table**: Date, Service, Staff, Client columns
- **Search** bar
- **Export** button
- Simple appointment log/audit trail

---

## 8. UX Patterns Summary

### Create/Edit Flows:
- **Full-screen dialog** for creating appointments (not a small modal)
- Header: X close (left) + title + Actions menu + Save button (right)
- Form + customer sidebar layout (2-column in dialog)
- **No separate page** for creation — always a dialog overlay

### Navigation Pattern:
- Module has its own sub-sidebar that replaces the main sidebar
- Back arrow returns to main dashboard
- Flat items for primary views (Overview, Calendar, Waitlist)
- Collapsible groups for configuration (Online booking, Settings)

### Settings Pattern:
- Long scrollable form pages with sections
- Toggle switches for on/off features
- Dropdowns for interval/timing selections
- Radio buttons for mutually exclusive choices
- Sticky Cancel/Save footer
- Premium features marked with star icon

### Empty States:
- Clean text with explanation + link to relevant settings
- CTA buttons for enabling features

### Calendar:
- Week view is the default
- Date range navigation with quick jumps
- Current time indicator (red line)
- Gray cells for unavailable hours
- "Create" button always visible in header

---

## 9. Comparison with Our Implementation

| Feature | Square | Avoqado (Current) |
|---------|--------|--------------------|
| Sidebar | Dedicated sub-sidebar replaces main | Collapsible sub-items in main sidebar |
| Overview | Setup wizard + upcoming + notifications | Stats cards + reservation table |
| Calendar | Week default, day/week toggle, "Range" label | Day default, day/week toggle |
| Create flow | Full-screen dialog from calendar | Full-screen modal from calendar (same) |
| Waitlist | Separate page, linked to online booking | Separate page with DataTable |
| Settings | 4 sub-pages (Calendar, Payments, Comms, History) | Single settings page |
| Online booking | 4 sub-pages (Channels, Settings, Widget, Invite) | Not implemented yet |
| Create button | Top-right "Create" (black filled) | "New Reservation" button |

### What We Already Match:
- Full-screen modal for creation (same pattern)
- Calendar with week view + day headers
- Waitlist as separate section
- Settings page

### Potential Improvements Inspired by Square:
1. **Split Settings into sub-pages** (Calendar & booking, Payments, Communications, History)
2. **Add Online Booking section** with Channels, Widget embed, Client invitations
3. **Calendar "Edit availability"** button for managing business hours
4. **Appointment attributes** filter/view on calendar
5. **Communications settings** with customizable SMS/email templates
6. **Cancellation policy** as dedicated settings sub-section
7. **Google Calendar sync** integration
8. **Export** button on history page
9. **Setup wizard** for onboarding new venues to reservations
