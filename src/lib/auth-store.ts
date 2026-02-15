import type { Session } from "../types";

const SESSION_KEY = "leads_session";

type Listener = (session: Session | null) => void;

let sessionCache: Session | null = null;
const listeners = new Set<Listener>();

function notify(session: Session | null) {
  for (const listener of listeners) {
    listener(session);
  }
}

function safeParseSession(raw: string | null): Session | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function getSession(): Session | null {
  if (sessionCache) return sessionCache;
  sessionCache = safeParseSession(localStorage.getItem(SESSION_KEY));
  return sessionCache;
}

export function setSession(session: Session) {
  sessionCache = session;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  notify(session);
}

export function clearSession() {
  sessionCache = null;
  localStorage.removeItem(SESSION_KEY);
  notify(null);
}

export function subscribeSession(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
