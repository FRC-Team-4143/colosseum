/**
 * Same-origin JSON client for the FastAPI backend (`/api/*`).
 *
 * A 401 means the Legion `mw_sso` session is missing or expired: the whole page is
 * bounced to `/api/auth/login`, which redirects to Legion and comes back with the
 * cookie set. Any other non-2xx becomes an {@link ApiError} carrying the backend's
 * `detail` string.
 */

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function redirectToLogin(): never {
  const returnTo = location.pathname + location.search;
  location.assign(`/api/auth/login?return_to=${encodeURIComponent(returnTo)}`);
  // Stop the caller's async flow while the browser navigates away.
  throw new ApiError(401, "Redirecting to sign in");
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
  });

  if (response.status === 401 && typeof location !== "undefined") redirectToLogin();

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const data = (await response.json()) as { detail?: unknown };
      if (typeof data?.detail === "string") detail = data.detail;
    } catch {
      /* non-JSON error body — keep the status line */
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const apiGet = <T>(path: string): Promise<T> => request<T>("GET", path);

export const apiSend = <T>(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> => request<T>(method, path, body);
