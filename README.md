# Demoless

Frontend for Demoless. Next.js 15 (App Router) + TypeScript + Tailwind. A faithful
port of the original design export: four state-driven screens in one prototype.

## Run

```bash
npm install
npm run dev      # http://localhost:3000
```

`npm run build` then `npm run start` for a production build.

## Structure

| Path | What |
|------|------|
| `app/page.tsx` | Holds state via `useDemoState`, renders the active screen + the floating PROTOTYPE nav |
| `lib/useDemoState.ts` | All UI state + derived values (mirrors the original prototype's `renderVals`) |
| `lib/data.ts` | Mock data: sections, captions, leads, pipeline stages, score/intent helpers |
| `lib/types.ts` | `DemoVals` — the single typed contract every screen reads from |
| `components/Landing.tsx` | Marketing landing + "Start AI Demo" CTA |
| `components/PreCallForm.tsx` | Pre-call form (name, email, role, size, use case, pain) |
| `components/DemoRoom.tsx` | Meet-style room: product share, 8 auto-advancing moments, section rail, controls, convert overlay |
| `components/Dashboard.tsx` | Pipeline kanban + lead detail drawer |
| `tailwind.config.ts` | Design palette as named color tokens (`brand`, `ink`, `night`, `muted`, ...) |

## Notes

- The bottom-left **PROTOTYPE** nav switches screens. The demo room auto-advances
  through its moments via the bottom progress bar (pause with the ❚❚ control).
- The AI rep avatar is a placeholder (the design export had no headshot). Swap in a
  real image in `PreCallForm.tsx` and `DemoRoom.tsx` when available.
- It's frontend-only with mock data, no backend wiring yet.
