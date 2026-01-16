# Spin Wheel Project Help

## What this app is
- React/Next.js prototype for a spin‑wheel game selector.
- Real‑time sync via WebSocket rooms (items, spins, votes, teams, settings).
- Admin claim/unlock with 4‑digit code; only admin can spin, edit, and toggle modes.

## How to run
- Dev: `npm run dev`
- Prod: `npm run build` then `npm run start`
- Docker: `docker compose up --build -d`

## Core features
- Room gating: if no `?room=...` param, user sees Join/Create room UI.
- Voting: each user can place one Gold/Silver/Bronze vote (replaces prior same tier).
- Wheel slices scale by votes in real‑time.
- Mystery mode hides labels (except admin editing).
- No‑repeat modes: off / no consecutive / once per session.
- Teams: admin can generate teams from voters (fallback to players list).
- Presence list: players show as colored pills.
- View mode: `?view=1` shows large wheel only.

## Admin flow
- First user can claim admin with 4‑digit code.
- Admin login button (top right) toggles a popover:
  - If admin: shows “You are admin” + logout.
  - If not admin: shows claim/unlock form.
- Admin code stored in session storage for edit sync.
- Only admin can spin and edit items/settings.

## Sync / WebSocket notes
- Server entry: `server.js` (custom Next server + `ws`).
- Room key: `?room=XYZ` (all data stored per room on server).
- Messages:
  - `spin` → broadcast to room, includes `targetRotation`.
  - `vote` → updates room vote map.
  - `teams` → broadcast final team state.
  - `items_update` → broadcast items; includes `sourceClientId`.
  - `settings_update` → broadcast voting/mystery/no‑repeat.
  - `presence` → broadcast players list.
  - `admin_claim` / `admin_unlock` / `admin_reset` → admin state.
  - `sync` → initial payload on connect (items, votes, settings, admin state, players).

## Important UI files
- `app/components/HomePage.tsx` — main state & WebSocket handling.
- `app/components/WheelSection.tsx` — wheel rendering.
- `app/components/HeaderBar.tsx` — top right status + admin button.
- `app/components/panels/*` — all sidebar panels.
- `app/hooks/useStoredState.ts` — local/session storage hook.
- `app/lib/constants.ts`, `app/lib/types.ts`, `app/lib/utils.ts`.
- `app/globals.css` — styling (including labels, admin popover).

## Recent fixes to remember
- `useSearchParams` wrapped by `app/page.tsx` (Suspense) -> `HomePage.tsx`.
- Label transitions: fast for edits, long for spins.
- Items sync uses `sourceClientId` to avoid self-echo flicker.
- Items/settings updates now sent directly from edit handlers.
- Admin-only access to edit/modes/controls/spin button.

## Troubleshooting
- If build fails with `useSearchParams` warning: ensure `app/page.tsx` uses `<Suspense>` + `HomePage`.
- If edits revert: verify admin is unlocked; ensure server running latest `server.js`.
- If admin claim seems duplicated: check `?room=` matches across clients.
