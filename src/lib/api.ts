import { clearSession, getSession, setSession } from "./auth-store";
import type {
  ApiErrorBody,
  GenerateMessageResponse,
  Lead,
  LeadHistoryResponse,
  LeadsListResponse,
  LeadStatus,
  Session
} from "../types";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  auth?: boolean;
  retried?: boolean;
  query?: Record<string, string | number | undefined>;
};

type LeadsFilters = {
  search?: string;
  status?: LeadStatus;
  page?: number;
  page_size?: number;
};

class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function buildUrl(path: string, query?: Record<string, string | number | undefined>) {
  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
}

async function parseResponseBody(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;
  return response.json();
}

async function tryRefreshSession() {
  const session = getSession();
  if (!session?.refreshToken) return null;

  const response = await fetch(buildUrl("/auth/refresh"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: session.refreshToken })
  });

  if (!response.ok) {
    clearSession();
    return null;
  }

  const refreshed = (await response.json()) as Session;
  setSession(refreshed);
  return refreshed;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true, retried = false, body, headers, query, ...rest } = options;
  const session = getSession();
  const requestHeaders = new Headers(headers);
  if (body !== undefined) {
    requestHeaders.set("Content-Type", "application/json");
  }
  if (auth && session?.accessToken) {
    requestHeaders.set("Authorization", `Bearer ${session.accessToken}`);
  }

  const response = await fetch(buildUrl(path, query), {
    ...rest,
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  if (response.status === 401 && auth && !retried) {
    const refreshed = await tryRefreshSession();
    if (refreshed) {
      return request<T>(path, { ...options, retried: true });
    }
  }

  if (!response.ok) {
    const errorBody = (await parseResponseBody(response)) as ApiErrorBody | null;
    if (errorBody?.error) {
      throw new ApiError(
        response.status,
        errorBody.error.code,
        errorBody.error.message,
        errorBody.error.details
      );
    }
    throw new ApiError(response.status, "HTTP_ERROR", `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await parseResponseBody(response)) as T;
}

export const api = {
  async login(email: string, password: string) {
    const session = await request<Session>("/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false
    });
    setSession(session);
    return session;
  },

  async logout() {
    try {
      await request<void>("/auth/logout", { method: "POST" });
    } finally {
      clearSession();
    }
  },

  getLeads(filters: LeadsFilters) {
    return request<LeadsListResponse>("/leads", { method: "GET", query: filters });
  },

  getLeadById(id: string) {
    return request<Lead>(`/leads/${id}`, { method: "GET" });
  },

  getLeadHistory(id: string) {
    return request<LeadHistoryResponse>(`/leads/${id}/history`, { method: "GET" });
  },

  updateLead(id: string, payload: { status?: LeadStatus }) {
    return request<Lead>(`/leads/${id}`, { method: "PATCH", body: payload });
  },

  generateMessage(id: string) {
    return request<GenerateMessageResponse>(`/leads/${id}/generate-message`, { method: "POST" });
  }
};

export { ApiError };
