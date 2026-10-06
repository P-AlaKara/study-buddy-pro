# Legacy clinical case bank

The v1 bank contained these live records:

| ID                                     | Title                                      |
| -------------------------------------- | ------------------------------------------ |
| `11111111-1111-4111-8111-111111111111` | A breathless patient in the emergency unit |
| `22222222-2222-4222-8222-222222222222` | A drowsy child with fever                  |
| `33333333-3333-4333-8333-333333333333` | Sudden pelvic pain in a young woman        |
| `44444444-3333-4333-8333-333333333333` | Confusion after a long ward stay           |

The complete, restorable SQL payload is retained in the immutable historical migrations:

- `supabase/migrations/20260925180303_f4d48ccb-15b4-4480-87b9-39d00802151f.sql` (first three cases and weekly challenge data)
- `supabase/migrations/20261005120000_gamification_progress_search.sql` (delirium case)

Those already-published migrations were intentionally not moved or edited because doing so would break clean database rebuilds and rewrite the effective history consumed by Lovable. The v2 migration removes their rows from the active bank after preserving them here by immutable source reference.
