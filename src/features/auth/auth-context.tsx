import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getSession,
  signOut as signOutFn,
  type AccountRole,
  type CurrentUserPayload,
} from "./auth.functions";
import { getMyProfile } from "@/features/profile/profile.functions";
import { getMyCoachProfile, type CoachProfile } from "@/features/usmle/usmle.functions";

type StudentProfile = Awaited<ReturnType<typeof getMyProfile>>;
// The shell reads name/email/id off whichever profile the account owns; the
// student-only fields are consumed only by student views.
export type AuthProfile = StudentProfile | CoachProfile;

interface AuthValue {
  user: CurrentUserPayload | null;
  profile: AuthProfile | null;
  role: AccountRole | null;
  isCoach: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const sessionQuery = useQuery({
    queryKey: ["auth", "session"],
    queryFn: () => getSession(),
    staleTime: 60_000,
  });
  const user = sessionQuery.data ?? null;
  const role = user?.role ?? null;

  const profileQuery = useQuery({
    queryKey: ["auth", "profile", user?.id, role],
    queryFn: () => (role === "coach" ? getMyCoachProfile() : getMyProfile()),
    enabled: !!user,
    staleTime: 30_000,
  });

  const value: AuthValue = {
    user,
    profile: (profileQuery.data as AuthProfile) ?? null,
    role,
    isCoach: role === "coach",
    isAuthenticated: !!user,
    isLoading: sessionQuery.isLoading || (!!user && profileQuery.isLoading),
    async signOut() {
      await signOutFn();
      queryClient.clear();
    },
    async refresh() {
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within an AuthProvider");
  return value;
}
