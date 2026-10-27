// Supabase Auth has been removed in favour of application-owned authentication.
// This module now re-exports the app-owned auth middleware so existing server
// functions keep working. New code should import from "@/features/auth/middleware".
//
// The handler context still exposes `userId` (now an app_users.id) plus the new
// `profileId`; the former `supabase` / `claims` context fields are gone.
export {
  requireAuth,
  requireAuth as requireSupabaseAuth,
  optionalAuth,
} from "@/features/auth/middleware";
