import { clearSession, getSession, setSession } from "./auth-store";
import type {
  ApiErrorBody,
  GenerateMessageResponse,
  ImportConfirmResponse,
  ImportPreviewResponse,
  Lead,
  LeadHistoryResponse,
  LeadsListResponse,
  LeadStatus,
  CurrentPartner,
  Partner,
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

type LeadsExportFilters = {
  partner_id?: string;
  status?: LeadStatus;
  school?: string;
  city?: string;
  search?: string;
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
  const hasBody = body !== undefined && body !== null;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  if (hasBody && !isFormData) {
    requestHeaders.set("Content-Type", "application/json");
  }
  if (auth && session?.accessToken) {
    requestHeaders.set("Authorization", `Bearer ${session.accessToken}`);
  }

  const response = await fetch(buildUrl(path, query), {
    ...rest,
    headers: requestHeaders,
    body: hasBody ? (isFormData ? body : JSON.stringify(body)) : undefined
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

async function requestBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const { auth = true, retried = false, body, headers, query, ...rest } = options;
  const session = getSession();
  const requestHeaders = new Headers(headers);
  const hasBody = body !== undefined && body !== null;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  if (hasBody && !isFormData) {
    requestHeaders.set("Content-Type", "application/json");
  }
  if (auth && session?.accessToken) {
    requestHeaders.set("Authorization", `Bearer ${session.accessToken}`);
  }

  const response = await fetch(buildUrl(path, query), {
    ...rest,
    headers: requestHeaders,
    body: hasBody ? (isFormData ? body : JSON.stringify(body)) : undefined
  });

  if (response.status === 401 && auth && !retried) {
    const refreshed = await tryRefreshSession();
    if (refreshed) {
      return requestBlob(path, { ...options, retried: true });
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

  return response.blob();
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

  exportLeadsXlsx(filters: LeadsExportFilters) {
    return requestBlob("/leads/export/xlsx", { method: "GET", query: filters });
  },

  exportLeadsCsv(filters: LeadsExportFilters) {
    return requestBlob("/leads/export/csv", { method: "GET", query: filters });
  },

  getPartners() {
    return request<Partner[]>("/partners", { method: "GET" });
  },

  getCurrentPartner() {
    return request<CurrentPartner>("/partners/me", { method: "GET" });
  },

  createLead(payload: {
    partner_id?: string;
    ignore_duplicates?: boolean;
    student_name: string;
    email: string;
    phone_country: string;
    phone_national: string;
    school: string;
    city: string;
  }) {
    return request<Lead>("/leads", { method: "POST", body: payload });
  },

  getLeadById(id: string) {
    return request<Lead>(`/leads/${id}`, { method: "GET" });
  },

  getLeadHistory(id: string) {
    return request<LeadHistoryResponse>(`/leads/${id}/history`, { method: "GET" });
  },

  updateLead(id: string, payload: {
    student_name?: string;
    email?: string;
    phone_country?: string;
    phone_national?: string;
    school?: string;
    city?: string;
    status?: LeadStatus;
    note?: string;
  }) {
    return request<Lead>(`/leads/${id}`, { method: "PATCH", body: payload });
  },

  deleteLead(id: string) {
    return request<void>(`/leads/${id}`, { method: "DELETE" });
  },

  generateMessage(id: string) {
    return request<GenerateMessageResponse>(`/leads/${id}/generate-message`, { method: "POST" });
  },

  previewImportXls(payload: { file: File; partner_id?: string }) {
    const form = new FormData();
    form.append("file", payload.file);
    if (payload.partner_id) {
      form.append("partner_id", payload.partner_id);
    }
    return request<ImportPreviewResponse>("/imports/xls/preview", {
      method: "POST",
      body: form
    });
  },

  confirmImport(importId: string, payload?: { ignore_duplicates?: boolean }) {
    return request<ImportConfirmResponse>(`/imports/${importId}/confirm`, {
      method: "POST",
      body: payload ?? { ignore_duplicates: true }
    });
  }
};

export { ApiError };
