# Repository Guidelines

## Project Structure & Module Organization

- App code in `src/`: components (`src/components`), pages (`src/pages`), routes (`src/routes`), services (`src/services`), hooks (`src/hooks`), context (`src/context`), utils (`src/utils`), types (`src/types`), styles/assets (`src/styles`, `src/assets`).
- Entry points: `src/main.tsx`, `src/App.tsx`; global i18n in `src/i18n.ts`.
- Public assets in `public/`; build output in `dist/`.
- Scripts in `scripts/`; example: `scripts/check-i18n.js`.
- Optional tests live under `tests/unit/...` by feature (e.g., `tests/unit/services/dashboard`).

## Build, Test, and Development Commands

- `npm run dev` — Start Vite dev server with HMR.
- `npm run build` — Type-check and build to `dist/`.
- `npm run preview` — Serve the production build locally.
- `npm run lint` — Lint codebase with ESLint.
- `npm run lint:i18n` — Verify missing/unused translation keys.
- `npm run deploy` / `deploy:preview` — Deploy via Cloudflare Pages (wrangler).

## Coding Style & Naming Conventions

- TypeScript + React 18; Vite bundling; Tailwind CSS v4. Use Prettier (`.prettierrc`) and ESLint (`eslint.config.js`).
- Two-space indentation; prefer named exports. Components in PascalCase (`src/components/FeatureCard.tsx`); hooks `useX.ts`.
- Keep UI text out of code: use `react-i18next` (`useTranslation`) and keys in `src/i18n.ts`.
- Follow visual patterns in `THEME-GUIDELINES.md` and tips in `CLAUDE.md`.

## Testing Guidelines

- Place unit tests under `tests/unit` mirroring `src/` (e.g., `FeatureService.test.ts`).
- Prefer Vitest + Testing Library when adding tests; keep tests isolated and fast.
- Name files `*.test.ts`/`*.test.tsx`; aim for critical-path coverage over blanket quotas.

## Commit & Pull Request Guidelines

- Use Conventional Commits: `feat(scope): ...`, `fix(scope): ...`, `refactor: ...`, `chore: ...` (see `git log`).
- PRs include: clear description, linked issues, before/after screenshots for UI, and a note of added/updated i18n keys.
- Ensure `npm run lint`, `npm run build`, and `npm run lint:i18n` pass.

## Agent-Specific Instructions (i18n)

- Internationalization is mandatory for all user-facing text. Wrap strings with `t('group.key')`; add `en`/`es` keys in `src/i18n.ts` (groups: `header`, `sidebar`, `dashboard`, `revenue`, `featureMgmt`, `venueMgmt`, `detailsView`, `categories`, `featureStatuses`).
- Format numbers/dates/currency with `Intl.*` using `i18n.language`; do not render raw enums—map to translation keys.
- Reuse `src/components/language-switcher.tsx`; do not add duplicate toggles.
