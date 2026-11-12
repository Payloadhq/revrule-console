import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { RevRuleClient, sameOriginBaseUrl } from '../api/client';
import type { SessionPrincipal } from '../api/client';

const API_KEY_STORAGE = 'revrule_api_key';
const ACCOUNT_ID_STORAGE = 'revrule_account_id';

export type AuthMode = 'key' | 'session' | 'none';

export interface AuthContextValue {
  apiKey: string | null;
  accountId: string | null;
  /** 'key' = pasted API key, 'session' = Payload identity browser session. */
  authMode: AuthMode;
  /** Identity principal when authMode is 'session', else null. */
  principal: SessionPrincipal | null;
  isConnected: boolean;
  client: RevRuleClient;
  setCredentials: (key: string, accountId: string | null) => void;
  clearCredentials: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): ReactNode {
  // Lazy initializers restore any persisted credentials on mount.
  const [apiKey, setApiKey] = useState<string | null>(() => localStorage.getItem(API_KEY_STORAGE));
  const [accountId, setAccountId] = useState<string | null>(() =>
    localStorage.getItem(ACCOUNT_ID_STORAGE),
  );
  const [principal, setPrincipal] = useState<SessionPrincipal | null>(null);
  const probedRef = useRef(false);

  // No stored key: probe for an identity browser session on the origin
  // that served the console. The session cookie is host-bound, so this
  // only succeeds where the rail itself serves the console (or a future
  // product subdomain on payloadhq.dev); elsewhere it quietly misses and
  // the console stays in key mode, exactly as before.
  useEffect(() => {
    if (apiKey || probedRef.current) return;
    probedRef.current = true;
    const probe = RevRuleClient.forSession(sameOriginBaseUrl());
    let cancelled = false;
    probe
      .getSession()
      .then((p) => {
        if (!cancelled) setPrincipal(p);
      })
      .catch(() => {
        /* no session on this origin — key mode remains available */
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  const sessionClient = useMemo(
    () => (principal ? RevRuleClient.forSession(sameOriginBaseUrl()) : null),
    [principal],
  );
  const keyClient = useMemo(() => new RevRuleClient(apiKey ?? undefined), [apiKey]);
  const client = sessionClient ?? keyClient;
  const authMode: AuthMode = apiKey ? 'key' : principal ? 'session' : 'none';

  const setCredentials = useCallback((key: string, nextAccountId: string | null): void => {
    localStorage.setItem(API_KEY_STORAGE, key);
    if (nextAccountId !== null) {
      localStorage.setItem(ACCOUNT_ID_STORAGE, nextAccountId);
    } else {
      localStorage.removeItem(ACCOUNT_ID_STORAGE);
    }
    setApiKey(key);
    setAccountId(nextAccountId);
  }, []);

  const clearCredentials = useCallback((): void => {
    localStorage.removeItem(API_KEY_STORAGE);
    localStorage.removeItem(ACCOUNT_ID_STORAGE);
    setApiKey(null);
    setAccountId(null);
    if (principal) {
      // Best-effort server-side revocation; the local state drops either way.
      RevRuleClient.forSession(sameOriginBaseUrl())
        .logoutSession()
        .catch(() => undefined)
        .finally(() => setPrincipal(null));
    }
  }, [principal]);

  const value = useMemo<AuthContextValue>(
    () => ({
      apiKey,
      accountId,
      authMode,
      principal,
      isConnected: apiKey !== null || principal !== null,
      client,
      setCredentials,
      clearCredentials,
    }),
    [apiKey, accountId, authMode, principal, client, setCredentials, clearCredentials],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
