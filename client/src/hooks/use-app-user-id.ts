import { useUser } from "@clerk/clerk-react";

const DEV_BYPASS_AUTH = import.meta.env.VITE_DEV_BYPASS_AUTH === "true";

export function useAppUserId(): string | undefined {
  if (DEV_BYPASS_AUTH) return "dev_local_user";
  // Compile-time constant: bypass builds never call useUser (no ClerkProvider).
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { user } = useUser();
  return user?.id;
}
