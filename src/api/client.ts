/**
 * Typed client for the RevRule API (https://payload-rail.fly.dev/v1).
 *
 * All monetary amounts are integers in micros: 1 USD = 1,000,000 micros.
 */
import type {
  ApiError,
  EconomicEvent,
  Entitlement,
  GraphSpec,
  LedgerEntry,
  RevenueGraph,
} from './types';

export const REVRULE_BASE_URL = 'https://payload-rail.fly.dev/v1';

/**
 * Base URL for same-origin API calls. When the console is served by the
 * rail itself (https://api.payloadhq.dev/revrule-console/), the identity
 * session cookie is host-bound to that origin, so session-mode requests
 * must go to the origin that served the page — never to a different host.
 */
export function sameOriginBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/v1`;
  }
  return REVRULE_BASE_URL;
}

/**
 * How the client authenticates:
 * - 'key':     an API key (legacy key or v2 user credential) in an
 *              Authorization: Bearer header. The historical console mode.
 * - 'session': the Payload identity browser session (payload_session
 *              cookie, credentials: 'include'). The rail resolves the
 *              session to the org and enforces its entitlement server-side,
 *              so a signed-in customer needs no pasted key.
 */
export type RevRuleAuthMode = 'key' | 'session';

export interface SessionPrincipal {
  user_id: string;
  org_id: string;
  email: string | null;
  role: string | null;
  via: string;
  expires_at?: string;
}

export interface EntitlementCheck {
  org_id: string;
  user_id: string;
  product: string;
  entitled: boolean;
  tier: string | null;
  status: string;
  features: unknown[];
  limits: Record<string, unknown>;
  checked_at: string;
}

/** 1 USD = 1,000,000 micros. */
export const MICROS_PER_USD = 1_000_000;

/** Error thrown on non-2xx responses; code/message parsed from the API error body. */
export class RevRuleApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'RevRuleApiError';
    this.code = code;
    this.status = status;
  }
}

export interface Fee {
  kind: string;
  amountMicros: number;
  [key: string]: unknown;
}

export interface AccessKeyResult {
  key: string;
  accountId: string;
  tier: string;
  notice: string;
  docs: string;
}

export interface EventResult {
  eventId: string;
  graphId: string;
  graphVersion: number;
  idempotentReplay: boolean;
  entitlements: Entitlement[];
  fees: Fee[];
  payloadFee: Fee | null;
  skipped: unknown[];
  distributions: unknown[];
  ledgerEntries: LedgerEntry[];
  note: string;
}

export interface SimulationResult {
  eventId: string;
  graphId: string;
  graphVersion: number;
  simulated: boolean;
  entitlements: Entitlement[];
  fees: Fee[];
  payloadFee: Fee | null;
  skipped: unknown[];
  explanations: unknown[];
  note: string;
}

export interface LedgerFilters {
  eventId?: string;
  participantId?: string;
  type?: string;
}

export interface CryptoConfig {
  enabled: boolean;
  network: string;
  asset: string;
  assetContract: string;
  payTo: string | null;
  purchasePriceUsdc: string;
  eventPriceUsdc: string;
  note: string;
}

export interface FeesBalance {
  accruedMicros: number;
  settledMicros: number;
  outstandingMicros: number;
  outstandingUsdc: string;
  payTo: string | null;
  license: unknown;
}

/** Convert a USD amount to micros (integer). */
export function toMicros(usd: number): number {
  return Math.round(usd * MICROS_PER_USD);
}

/** Format a micros amount as a USD string (e.g. "$1,234.56"). */
export function fromMicros(micros: number): string {
  return (micros / MICROS_PER_USD).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}

export class RevRuleClient {
  private baseUrl: string;
  private apiKey: string | null;
  private authMode: RevRuleAuthMode;

  constructor(
    apiKey?: string | null,
    baseUrl: string = REVRULE_BASE_URL,
    opts: { authMode?: RevRuleAuthMode } = {},
  ) {
    this.apiKey = apiKey ?? null;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.authMode = opts.authMode ?? 'key';
  }

  /** A client that authenticates with the identity browser session. */
  static forSession(baseUrl: string = sameOriginBaseUrl()): RevRuleClient {
    return new RevRuleClient(null, baseUrl, { authMode: 'session' });
  }

  getAuthMode(): RevRuleAuthMode {
    return this.authMode;
  }

  setKey(key: string | null): void {
    this.apiKey = key;
  }

  getKey(): string | null {
    return this.apiKey;
  }

  private async authFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.authMode === 'key' && this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      // Session mode rides on the payload_session cookie; the browser
      // only sends it when credentials are explicitly included.
      credentials: this.authMode === 'session' ? 'include' : init.credentials,
      headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
    });
    if (!res.ok) {
      throw await RevRuleClient.toApiError(res);
    }
    return (await res.json()) as T;
  }

  /** Session-only fetch: always cookie-based, never sends an API key. */
  private async sessionFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers as Record<string, string> | undefined),
      },
    });
    if (!res.ok) {
      throw await RevRuleClient.toApiError(res);
    }
    return (await res.json()) as T;
  }

  /** GET /v1/auth/session — who the browser session belongs to. */
  getSession(): Promise<SessionPrincipal> {
    return this.sessionFetch<SessionPrincipal>('/auth/session');
  }

  /** POST /v1/auth/session/logout — revoke the browser session. */
  logoutSession(): Promise<{ ok: boolean }> {
    return this.sessionFetch<{ ok: boolean }>('/auth/session/logout', { method: 'POST' });
  }

  /** GET /v1/auth/entitlements/check?product=... — server-side entitlement verdict. */
  checkEntitlement(product: string): Promise<EntitlementCheck> {
    return this.sessionFetch<EntitlementCheck>(
      `/auth/entitlements/check?product=${encodeURIComponent(product)}`,
    );
  }

  private static async toApiError(res: Response): Promise<RevRuleApiError> {
    let code = 'HTTP_ERROR';
    let message = `Request failed with status ${res.status}`;
    try {
      const body = (await res.json()) as Partial<ApiError>;
      if (body?.error) {
        code = body.error.code || code;
        message = body.error.message || message;
      }
    } catch {
      // Non-JSON error body; keep the HTTP defaults.
    }
    return new RevRuleApiError(code, message, res.status);
  }

  /** POST /v1/access-keys — issue a new API key (public route, no auth required). */
  createAccessKey(label?: string): Promise<AccessKeyResult> {
    const body = label !== undefined ? { label } : {};
    return this.authFetch<AccessKeyResult>('/access-keys', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /** POST /v1/graphs — define a new graph (status: draft). */
  createGraph(spec: GraphSpec): Promise<{ graph: RevenueGraph }> {
    return this.authFetch('/graphs', {
      method: 'POST',
      body: JSON.stringify(spec),
    });
  }

  /** GET /v1/graphs/:id — fetch a graph. */
  getGraph(id: string): Promise<{ graph: RevenueGraph }> {
    return this.authFetch(`/graphs/${encodeURIComponent(id)}`);
  }

  /** POST /v1/graphs/:id/activate — draft -> active. */
  activateGraph(id: string): Promise<{ graph: RevenueGraph }> {
    return this.authFetch(`/graphs/${encodeURIComponent(id)}/activate`, {
      method: 'POST',
    });
  }

  /** POST /v1/graphs/:id/events — evaluate one event, writes ledger entries. */
  submitEvent(graphId: string, event: EconomicEvent): Promise<EventResult> {
    return this.authFetch(`/graphs/${encodeURIComponent(graphId)}/events`, {
      method: 'POST',
      body: JSON.stringify({ event }),
    });
  }

  /** POST /v1/graphs/:id/simulate — dry run, zero side effects. */
  simulateEvent(graphId: string, event: EconomicEvent): Promise<SimulationResult> {
    return this.authFetch(`/graphs/${encodeURIComponent(graphId)}/simulate`, {
      method: 'POST',
      body: JSON.stringify({ event }),
    });
  }

  /** GET /v1/graphs/:id/ledger — filtered read plus chain verification. */
  getLedger(
    graphId: string,
    filters: LedgerFilters = {},
  ): Promise<{ entries: LedgerEntry[]; chainValid: boolean }> {
    const params = new URLSearchParams();
    if (filters.eventId !== undefined) params.set('eventId', filters.eventId);
    if (filters.participantId !== undefined) params.set('participantId', filters.participantId);
    if (filters.type !== undefined) params.set('type', filters.type);
    const query = params.toString();
    const path = `/graphs/${encodeURIComponent(graphId)}/ledger${query ? `?${query}` : ''}`;
    return this.authFetch(path);
  }

  /** GET /v1/crypto/config — how to pay in crypto (USDC on Base). */
  getCryptoConfig(): Promise<CryptoConfig> {
    return this.authFetch('/crypto/config');
  }

  /** GET /v1/fees/balance — accrued vs settled infrastructure fees. */
  getFeesBalance(): Promise<FeesBalance> {
    return this.authFetch('/fees/balance');
  }
}
