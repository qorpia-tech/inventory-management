# QorStock Events · interactive demo

A clickable demo of **QorStock Events**: inventory and event reservations for a catering company. It answers two questions: *can I take this order for that date?* and *what is still out?*

Everything runs in the browser with **fictional data**. Nothing is sent to a server: the scenario is stored in `localStorage` and can be reset from the demo panel (administrator role).

## What it shows

- **Agenda and event detail**: availability per time window, confirmation that validates every line together and reports requested, available and missing units.
- **Warehouse (phone first)**: partial dispatch, returns in parts (good, washing, broken, lost), washing release, overdue alerts.
- **Inventory**: stock by state (available, washing, out), opening balance, receipts, adjustments with a reason and the full movement history.
- **Previews**: staff attendance, the public catering page at `/c/valtiera/` with a WhatsApp inquiry, and QorStock pricing at `/planes/`.
- **Demo panel**: role switcher (administrator, coordinator, warehouse), the six-step guided tour, a demo clock that only moves forward, and the reset.

## Architecture

| Path | Responsibility |
|---|---|
| `src/domain/` | Pure TypeScript business rules: availability sweep, reservations, dispatch, returns, washing, ledger, permissions, idempotency. No React, no browser APIs, injected clock. |
| `src/application/gateway.ts` | Port between screens and rules. An HTTP adapter can replace the demo adapter. |
| `src/demo/` | Browser adapter (`localStorage`), seeded scenario, fictional staff, storefront and pricing data. |
| `src/ui/`, `src/app/` | Next.js App Router screens, mobile first, exported as a static site. |

## Run, test and build

Requires Node.js 24 and npm.

```bash
npm ci
npm run dev          # http://localhost:3000
npm run typecheck
npm run lint
npm test             # Vitest: domain rules and the scripted scenario
npm run build        # static export in out/
npm start            # serves out/ on http://localhost:3100
npx playwright install chromium
npm run test:e2e     # phone-sized walk through the script (build first)
```

`NEXT_PUBLIC_BASE_PATH` sets the base path of the export. It is empty locally; the GitHub Pages workflow (`.github/workflows/pages.yml`) builds with `/inventory-management` and deploys `out/` on every push to `main`.
