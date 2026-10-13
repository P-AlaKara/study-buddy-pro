import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const prototypeSignInSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(254),
});

/**
 * Prototype-only sign-in: creates a Supabase magic-link token without sending
 * an email so the client can exchange it for a normal authenticated session.
 *
 * This intentionally does not prove ownership of the submitted email and must
 * be replaced with a verified sign-in flow before production use.
 */
export const createPrototypeAnnieSignIn = createServerFn({ method: "POST" })
  .validator((input: unknown) => prototypeSignInSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: data.email.toLowerCase(),
    });

    if (error || !link.properties?.hashed_token) {
      throw new Error(error?.message ?? "Could not start the prototype session.");
    }

    return { tokenHash: link.properties.hashed_token };
  });
