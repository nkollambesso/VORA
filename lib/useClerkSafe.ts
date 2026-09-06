/**
 * Safe Clerk hook wrappers that gracefully handle the case where
 * ClerkProvider is not mounted (e.g., web demo without a valid publishable key).
 *
 * Strategy: lazy-require the hooks inside the wrapper functions.
 * This avoids module-level crashes when Clerk context is absent.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

type UserResult = {
  user: Record<string, any> | null;
  isLoaded: boolean;
};

type AuthResult = {
  isLoaded: boolean;
  isSignedIn: boolean | undefined;
  userId: string | null;
  sessionId: string | null;
  signOut: (...args: any[]) => Promise<void>;
  getToken: (...args: any[]) => Promise<string | null>;
  [key: string]: any;
};

// ── Fallback values ────────────────────────────────────────────────────────────

const EMPTY_USER: UserResult = { user: null, isLoaded: true };

const EMPTY_AUTH: AuthResult = {
  isLoaded: true,
  isSignedIn: false,
  userId: null,
  sessionId: null,
  actor: null,
  orgId: null,
  orgRole: null,
  orgSlug: null,
  has: () => false,
  signOut: async () => {},
  getToken: async () => null,
};

// ── Safe hooks ─────────────────────────────────────────────────────────────────

/**
 * Safe replacement for `useUser()` from @clerk/clerk-expo.
 * Returns `{ user: null, isLoaded: true }` when Clerk is unavailable.
 */
export function useClerkUser(): UserResult {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useUser } = require("@clerk/clerk-expo");
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const result = useUser();
    return { user: result.user ?? null, isLoaded: result.isLoaded };
  } catch {
    return EMPTY_USER;
  }
}

/**
 * Safe replacement for `useAuth()` from @clerk/clerk-expo.
 * Returns empty auth state when Clerk is unavailable.
 */
export function useClerkAuth(): AuthResult {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useAuth } = require("@clerk/clerk-expo");
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useAuth();
  } catch {
    return EMPTY_AUTH;
  }
}
