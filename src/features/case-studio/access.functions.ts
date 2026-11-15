import { createServerFn } from "@tanstack/react-start";
import { optionalAuth } from "@/features/auth/middleware";

export interface CaseStudioAccess {
  /** True when the signed-in account is on the content-creator allowlist. */
  allowed: boolean;
}

/**
 * Decides, on the server, whether the current account may use the case studio.
 * The route guard and the navigation both call this; the allowlist itself
 * (CONTENT_CREATOR_EMAILS) never reaches the browser.
 */
export const getCaseStudioAccess = createServerFn({ method: "GET" })
  .middleware([optionalAuth])
  .handler(async ({ context }): Promise<CaseStudioAccess> => {
    if (!context.userId) return { allowed: false };
    const { getUserById } = await import("@/server/auth/users.server");
    const { isContentCreator } = await import("@/server/auth/content-creators.server");
    const user = await getUserById(context.userId);
    if (!user || user.status !== "active") return { allowed: false };
    return { allowed: isContentCreator(user.email) };
  });
