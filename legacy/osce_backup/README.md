# Legacy OSCE backup

This directory preserves the OSCE implementation retired at the start of the v2 rebuild.

The archived feature loaded published station records from Supabase and provided a station bank,
solo/peer checklist marking, a timed circuit, and checklist feedback. It has intentionally been
removed from the live application. Historical database migrations are left in place because they
are immutable project history and may already have been applied to connected environments.

Archived source paths mirror their former locations under `src/`:

- `src/lib/osce.ts`
- `src/components/osce-parts.tsx`
- `src/routes/osce.tsx`
- `src/routes/osce.index.tsx`
- `src/routes/osce.$stationId.tsx`
- `src/routes/osce.exam.tsx`

Do not import these files into the v2 feature. They exist for reference and recovery only.
