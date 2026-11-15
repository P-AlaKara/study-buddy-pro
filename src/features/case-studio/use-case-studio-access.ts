import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/auth-context";
import { getCaseStudioAccess } from "./access.functions";

/**
 * Whether the signed-in account may open the case studio. Used only to show or
 * hide the "Manage cases" entry points; the route itself re-checks on the
 * server in `beforeLoad`.
 */
export function useCaseStudioAccess(): boolean {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["case-studio", "access", user?.id ?? null],
    queryFn: () => getCaseStudioAccess(),
    enabled: !!user,
    staleTime: 5 * 60_000,
  });
  return query.data?.allowed ?? false;
}
