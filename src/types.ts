export type UserRole = "MASTER" | "PARTNER";

export type LeadStatus = "NEW" | "FIRST_CONTACT" | "RESPONDED" | "NO_RESPONSE" | "WON" | "LOST";

export type ContactChannel = "WHATSAPP" | "EMAIL";

export type AuthUser = {
  id: string;
  role: UserRole;
  partnerId: string | null;
};

export type Session = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export type Lead = {
  id: string;
  partnerId: string;
  createdByUserId: string;
  studentName: string;
  email: string;
  phoneRaw: string;
  phoneE164: string;
  phoneCountry: string;
  phoneValid: boolean;
  school: string;
  city: string;
  status: LeadStatus;
  firstContactedAt: string | null;
  lastContactedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LeadsListResponse = {
  items: Lead[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
  };
};

export type GenerateMessageResponse = {
  lead: Lead;
  template_version: string;
  channel: ContactChannel;
  to_address: string;
  message: string;
};

export type LeadStatusHistoryItem = {
  id: string;
  leadId: string;
  oldStatus: LeadStatus;
  newStatus: LeadStatus;
  changedByUserId: string;
  note: string | null;
  createdAt: string;
  changedByUser: {
    id: string;
    name: string;
    email: string;
  };
};

export type ContactEventItem = {
  id: string;
  leadId: string;
  userId: string;
  channel: ContactChannel;
  messageTemplateVersion: string;
  messageRendered: string;
  toAddress: string;
  success: boolean;
  errorReason: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
};

export type LeadHistoryResponse = {
  lead_id: string;
  status_history: LeadStatusHistoryItem[];
  contact_events: ContactEventItem[];
};

export type ApiErrorBody = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type Partner = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
};

export type CurrentPartner = {
  id: string | null;
  name: string;
  isActive: boolean;
};

export type ImportPreviewResponse = {
  import_id: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  preview_sample: Array<{
    student_name: string;
    email: string;
    phone: string;
    school: string;
    city: string;
  }>;
  errors_sample: Array<{
    row_number: number;
    error: string;
  }>;
};

export type ImportConfirmResponse = {
  import_id: string;
  status: "DRAFT" | "PROCESSING" | "DONE" | "FAILED" | "CANCELED";
  total_rows: number;
  success_rows: number;
  error_rows: number;
};
