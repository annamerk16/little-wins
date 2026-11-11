---
type: feature
---
# A sidebar links the app's main screens and marks the current one

## Why
Users move between their timeline, the map of where their wins happened,
their recap, and their profile without typing URLs, and can always tell
which screen they are on.

## Where it lives
- `apps/web/components/Sidebar.tsx` — client component; the navigation
  links and current-page marking.
- `apps/web/app/(private)/(app)/layout.tsx` — route-group layout that renders the
  sidebar beside the page content. The group adds no URL segment.
- `apps/web/app/(private)/(app)/timeline/page.tsx` — mounts the existing
  [timeline](../wins/timeline.md) component.
- `apps/web/app/(private)/(app)/map/page.tsx`, `apps/web/app/(private)/(app)/recap/page.tsx`,
  `apps/web/app/(private)/(app)/profile/page.tsx` — placeholder pages.
- `apps/web/components/ComingSoon.tsx` — the placeholder body those pages
  share.

## Behavior
- `/timeline`, `/map`, `/recap`, and `/profile` require a verified session.
  Signed-out visitors are redirected to `/login` by the parent private layout
  before the screen is shown. Signed-in visitors share its sign-out control.
  These four routes are allowed local login return paths; see
  [authentication](../authentication/sign-in.md).
- The sidebar is a navigation landmark (`<nav aria-label="Main">`) with four
  links, in this order: Timeline (`/timeline`), Map (`/map`), Recap
  (`/recap`), Profile (`/profile`).
- The link for the current route carries `aria-current="page"` and a
  distinct visual style; no other link does.
- Links are ordinary anchors (Next.js `Link`): they work with Tab and Enter,
  middle-click, and open-in-new-tab, and show a visible focus outline.
- At widths of 640px and up, the sidebar is a fixed-width column on the
  left of the content. Below 640px, the same links render as a horizontal
  bar above the content; nothing is hidden behind a menu button.
- Map, Recap, and Profile render a placeholder: the page's name as a
  heading and one line saying the screen is coming soon. They fetch no data.
- The sidebar appears only on routes inside the `(app)` group. The homepage
  (`/`) and `/sandbox/*` routes are unchanged.
- An unknown route (e.g. `/settings`) shows the default 404 page without a
  sidebar.

## Examples
| State / input | Behavior |
|---|---|
| Signed-out visit to any of the four routes | Redirect to `/login`; private screen is not shown |
| Signed-in visit to `/timeline` | Sidebar and sign-out shown; Timeline marked current; wins load |
| Signed-in visit to `/map` | Sidebar and sign-out shown; Map marked current; "coming soon" placeholder |
| Click Recap from `/timeline` | Navigates to `/recap`; Recap becomes current |
| Keyboard: Tab through private controls and sidebar | Sign-out and the four links are reachable, each with a visible outline |
| Window 375px wide | Links shown in a horizontal bar above the content |
| Visit `/` | Homepage unchanged, no sidebar |
| Visit `/settings` | 404, no sidebar |

## Verify
- `pnpm test`, `pnpm typecheck`, and `pnpm build` pass; the build output
  lists `/timeline`, `/map`, `/recap`, and `/profile`.
- Verify all four routes redirect to `/login` without a session or after
  logout. Sign in with each as `returnTo` and confirm the selected screen.
- With the local app running and a valid session, visit each route and check exactly
  one link is marked current.
- Keyboard-only pass: Tab through the sidebar, press Enter on each link.
- Narrow the window below 640px: the links move to a top bar and stay
  usable.
- Screen reader: the sidebar is announced as "Main, navigation" and the
  current link as "current page".

## Constraints & decisions
- The sidebar lives in a route-group layout, not the root layout, so the
  homepage and sandbox pages keep their current look and the shared root
  layout is not edited. The root body is a narrow centered column, so the
  group layout widens itself past it (up to 64rem, never wider than the
  viewport) instead of changing the root.
- Styling follows the log-a-win dialog's design values (off-white surface,
  dark green active state) until the team settles on shared theme tokens.
- No new dependencies; icons, if any, are inline SVG.
- Placeholders contain no fake data, so they can't be mistaken for working
  features.

## Out of scope
- The real map, recap, and profile screens — each gets its own spec when
  built.
- The homepage (`/`), owned by the `page.tsx` owner; whether it redirects to
  `/timeline` is that owner's decision.
- Sign-out mechanics and account switching — owned by
  [authentication](../authentication/sign-in.md); the shared private layout
  supplies the sign-out control.
