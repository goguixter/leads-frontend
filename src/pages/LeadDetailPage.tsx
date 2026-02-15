import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}

export function LeadDetailPage() {
  const { id = "" } = useParams();
  const [lead, setLead] = useState<Lead | null>(null);
  const [statusHistory, setStatusHistory] = useState<LeadStatusHistoryItem[]>([]);
  const [contactEvents, setContactEvents] = useState<ContactEventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        <Link to="/leads" className="button-secondary">
          Voltar
        </Link>
        <p className="error-message">{error}</p>
      </main>
    );
  }

  if (!lead) {
    return (
      <main className="page-shell">
        <Link to="/leads" className="button-secondary">
          Voltar
        </Link>
        <p className="empty-state">Lead não encontrado.</p>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <header className="topbar">
        <Link to="/leads" className="button-secondary">
          Voltar
        </Link>
        <button className="button-whatsapp" onClick={() => void handleSendWhatsApp()}>
          WhatsApp
        </button>
      </header>

      <section className="card">
        <h1>{lead.studentName}</h1>
        <p>{lead.email}</p>
        <p>{lead.phoneE164}</p>
        <p>
          {lead.school} • {lead.city}
        </p>
        <label>
          Status
          <select value={lead.status} onChange={(e) => void handleStatusChange(e.target.value as LeadStatus)}>
            {STATUS_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="card">
        <h2>Histórico de status</h2>
        {statusHistory.length === 0 ? <p className="empty-state">Sem alterações registradas.</p> : null}
        <div className="timeline">
          {statusHistory.map((item) => (
            <article className="timeline-item" key={item.id}>
              <p>
                {item.oldStatus} → {item.newStatus}
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
