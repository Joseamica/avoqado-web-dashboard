# Design Context

## Target Audience
Restaurant owners, retail managers, gym operators, and venue staff in Mexico. Many are non-technical — some elderly, some using a SaaS dashboard for the first time. The dashboard CLAUDE.md states: "Design for the least technical user."

## Use Cases
- Configure staff commission rates (percentage of sales, fixed amounts, tiered)
- Track team earnings and performance rankings
- Approve commission summaries at end of pay period
- Process payouts to staff
- Set sales goals and milestones

## Brand Personality
Professional, clean, trustworthy. B2B SaaS for venue management. Not flashy or playful — the user is running a business and needs clarity above all. The design system uses Radix UI + Tailwind with semantic color tokens (bg-background, text-foreground, bg-muted, etc.). Supports light and dark mode.

## Design Principles
1. Clarity over density — fewer choices visible at once
2. Progressive disclosure — simple defaults, advanced behind toggles
3. Spanish-first — all user-facing text in Spanish via i18n
4. Mobile-aware — many venue owners check from their phone
5. Empty states should guide, not just report emptiness
