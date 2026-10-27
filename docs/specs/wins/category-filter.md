---
type: feature
---
# Filter wins by category

## Why
Let users view wins from one category or return to all their wins.

## Where it lives
- apps/web/components/CategoryFilter.tsx
- apps/web/app/sandbox/category-filter/page.tsx
- Existing GET /api/wins endpoint; see list.md.

## Behavior
The filter is a labeled dropdown with All, Fitness, Academic,
Career, and Personal options. All is selected initially.

Selecting a category requests /api/wins?category=CATEGORY,
using uppercase category values. All requests /api/wins
without a category parameter.

The demo displays the returned wins, newest first.
It shows loading, empty, and error states, with a retry button
after errors. Older requests cannot replace newer results.

The existing API handles category validation and user scoping.

## Examples
| Selection or condition | Result |
|---|---|
| All | Show all returned wins |
| Academic | Request category=ACADEMIC |
| No matching wins | Show an empty-state message |
| Request fails | Show an error and Retry |
| Selection changes quickly | Show only the latest selection's results |

## Verify
Run pnpm test, pnpm typecheck, and pnpm build.
Open /sandbox/category-filter with the local database running.
Check each category, All, keyboard navigation, no matches,
request failure, retry, and rapid selection changes.
Use sample wins in at least two categories.

## Constraints & decisions
Use a native select and the existing API.
The component receives value and onChange props for reuse.
No new dependencies, database changes, or homepage edits.

## Out of scope
Connecting to the final timeline is coordinated separately
with its owner. Creating wins, monthly recap, and real
authentication are separate features.