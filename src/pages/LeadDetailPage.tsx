import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError, api } from "../lib/api";
import { openWhatsApp } from "../lib/whatsapp";
import type { ContactEventItem, Lead, LeadStatus, LeadStatusHistoryItem } from "../types";

const STATUS_OPTIONS: LeadStatus[] = [
  "NEW",
  "FIRST_CONTACT",
  "RESPONDED",
  "NO_RESPONSE",
  "WON",
  "LOST"
];

function statusLabel(status: LeadStatus) {
  switch (status) {
    case "FIRST_CONTACT":
      return "Primeiro contato";
    case "NO_RESPONSE":
      return "Sem resposta";
    case "NEW":
      return "Novo";
    case "RESPONDED":
      return "Respondeu";
    case "WON":
      return "Ganho";
    case "LOST":
      return "Perdido";
    default:
      return status;
  }
}

function statusBadgeClass(status: LeadStatus) {
  return `status-badge status-${status.toLowerCase()}`;
}

function statusIconClass(status: LeadStatus) {
  switch (status) {
    case "NEW":
      return "bi bi-person-plus-fill";
    case "FIRST_CONTACT":
      return "bi bi-chat-dots-fill";
    case "RESPONDED":
      return "bi bi-reply-fill";
    case "NO_RESPONSE":
      return "bi bi-telephone-x-fill";
    case "WON":
      return "bi bi-trophy-fill";
    case "LOST":
      return "bi bi-x-circle-fill";
    default:
      return "bi bi-tag-fill";
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}

export function LeadDetailPage() {
  const { session } = useAuth();
  const { id = "" } = useParams();
  const [lead, setLead] = useState<Lead | null>(null);
  const [statusHistory, setStatusHistory] = useState<LeadStatusHistoryItem[]>([]);
  const [contactEvents, setContactEvents] = useState<ContactEventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMaster = session?.user.role === "MASTER";

  async function loadLeadDetail() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [leadResponse, historyResponse] = await Promise.all([api.getLeadById(id), api.getLeadHistory(id)]);
      setLead(leadResponse);
      setStatusHistory(historyResponse.status_history);
      setContactEvents(historyResponse.contact_events);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Falha ao carregar dados do lead");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLeadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleStatusChange(newStatus: LeadStatus) {
    if (!id || !lead) return;
    try {
      const updated = await api.updateLead(id, { status: newStatus });
      setLead(updated);
      await loadLeadDetail();
    } catch (err) {
      if (err instanceof ApiError) {
        alert(err.message);
      } else {
        alert("Erro ao atualizar status");
      }
    }
  }

  async function handleSendWhatsApp() {
    if (!id) return;
    try {
      const response = await api.generateMessage(id);
      openWhatsApp(response.to_address, response.message);
      setLead(response.lead);
      await loadLeadDetail();
    } catch (err) {
      if (err instanceof ApiError) {
        alert(err.message);
      } else {
        alert("Erro ao gerar mensagem");
      }
    }
  }

  if (loading && !lead) {
    return (
      <main className="page-shell">
        <p>Carregando...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="page-shell">
        <Link to="/leads" className="button-secondary action-btn header-logout-btn">
          <i className="bi bi-arrow-left" aria-hidden="true" /> Voltar
        </Link>
        <p className="error-message">{error}</p>
      </main>
    );
  }

  if (!lead) {
    return (
      <main className="page-shell">
        <Link to="/leads" className="button-secondary action-btn header-logout-btn">
          <i className="bi bi-arrow-left" aria-hidden="true" /> Voltar
        </Link>
        <p className="empty-state">Lead não encontrado.</p>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <header className="topbar">
        <Link to="/leads" className="button-secondary action-btn header-logout-btn">
          <i className="bi bi-arrow-left" aria-hidden="true" /> Voltar
        </Link>
        {isMaster ? (
          <button className="button-whatsapp header-logout-btn" onClick={() => void handleSendWhatsApp()}>
            <i className="bi bi-whatsapp" aria-hidden="true" /> WhatsApp
          </button>
        ) : null}
      </header>

      <section className="card lead-detail-card">
        <h1>{lead.studentName}</h1>
        <p>{lead.email}</p>
        <p>{lead.phoneE164}</p>
        <p>
          {lead.school} • {lead.city}
        </p>
        <span
          className={`${statusBadgeClass(lead.status)} status-badge-corner`}
          title={statusLabel(lead.status)}
          aria-label={statusLabel(lead.status)}
        >
          <i className={statusIconClass(lead.status)} aria-hidden="true" />
        </span>
        <label>
          Status
          {isMaster ? (
            <select value={lead.status} onChange={(e) => void handleStatusChange(e.target.value as LeadStatus)}>
              {STATUS_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {statusLabel(item)}
                </option>
              ))}
            </select>
          ) : (
            <input value={statusLabel(lead.status)} readOnly />
          )}
        </label>
      </section>

      <section className="card">
        <h2>Histórico de status</h2>
        {statusHistory.length === 0 ? <p className="empty-state">Sem alterações registradas.</p> : null}
        <div className="timeline">
          {statusHistory.map((item) => (
            <article className="timeline-item" key={item.id}>
              <p>
                {statusLabel(item.oldStatus)} → {statusLabel(item.newStatus)}
              </p>
              <p>{item.note ?? "Sem observação"}</p>
              <p>
                {item.changedByUser.name} • {formatDate(item.createdAt)}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Contatos</h2>
        {contactEvents.length === 0 ? <p className="empty-state">Sem contatos registrados.</p> : null}
        <div className="timeline">
          {contactEvents.map((item) => (
            <article className="timeline-item" key={item.id}>
              <p>
                {item.channel} • {item.toAddress}
              </p>
              <p>{item.messageRendered}</p>
              <p>
                {item.success ? "Sucesso" : `Falha: ${item.errorReason ?? "sem motivo"}`} •{" "}
                {formatDate(item.createdAt)}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
