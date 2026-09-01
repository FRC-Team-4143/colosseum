import { ApiError, apiGet } from "$lib/api/http";

export interface Identity {
  memberCode: string;
  name: string;
  /** The signed-in member's Legion team_number — also their Colosseum workspace. */
  teamNumber: number;
  groups: string[];
}

let identity = $state<Identity | null>(null);
let loading = $state(true);
let error = $state<string | null>(null);

/**
 * The signed-in Legion member. `load()` runs once on boot: a 401 has already sent the
 * page to the SSO login by the time it rejects, so the only error worth showing is a 403
 * (signed in, but not on 4143 or 4423).
 */
export const session = {
  get identity(): Identity | null { return identity; },
  get workspace(): number | null { return identity?.teamNumber ?? null; },
  get loading(): boolean { return loading; },
  get error(): string | null { return error; },

  async load(): Promise<void> {
    loading = true;
    error = null;
    try {
      identity = await apiGet<Identity>("/api/me");
    } catch (cause) {
      identity = null;
      error = cause instanceof ApiError ? cause.message : "Could not load your session.";
    } finally {
      loading = false;
    }
  },

  logout(): void {
    location.assign("/api/auth/logout");
  },
};
