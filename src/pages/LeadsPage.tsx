import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError, api } from "../lib/api";
import { openWhatsApp } from "../lib/whatsapp";
import type { Lead, LeadStatus } from "../types";

const STATUS_OPTIONS: LeadStatus[] = [
  "NEW",
  "FIRST_CONTACT",
  "RESPONDED",
  "NO_RESPONSE",
  "WON",
  "LOST"
];

export function LeadsPage() {
  const { session, logout } = useAuth();
  const [items, setItems] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<LeadStatus | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userInfo = useMemo(() => {
    if (!session) return "";
    const partnerInfo = session.user.partnerId ? `partner ${session.user.partnerId}` : "MASTER";
    return `${session.user.role} (${partnerInfo})`;
  }, [session]);

  async function loadLeads() {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getLeads({
        search: search.trim() || undefined,
        status: status || undefined,
        page: 1,
        page_size: 30
      });
      setItems(response.items);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Falha ao carregar leads");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSendWhatsApp(leadId: string) {
    try {
      const response = await api.generateMessage(leadId);
      openWhatsApp(response.to_address, response.message);
      setItems((current) => current.map((lead) => (lead.id === leadId ? response.lead : lead)));
    } catch (err) {
      if (err instanceof ApiError) {
        alert(err.message);
      } else {
        alert("Erro ao gerar mensagem");
      }
    }
  }

  async function handleStatusChange(leadId: string, newStatus: LeadStatus) {
    try {
      const updated = await api.updateLead(leadId, { status: newStatus });
      setItems((current) => current.map((lead) => (lead.id === leadId ? updated : lead)));
    } catch (err) {
      if (err instanceof ApiError) {
        alert(err.message);
      } else {
        alert("Erro ao atualizar status");
      }
    }
  }

  return (
    <main className="page-shell">
      <header className="topbar">
        <div>
          <h1>Leads</h1>
          <p>{userInfo}</p>
        </div>
        <button className="button-secondary" onClick={() => void logout()}>
          Sair
        </button>
      </header>

      <section className="card form-row">
        <input
          type="search"
          placeholder="Buscar por nome, email ou telefone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value as LeadStatus | "")}>
          <option value="">Todos os status</option>
          {STATUS_OPTIONS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <button className="button-primary" onClick={() => void loadLeads()} disabled={loading}>
          {loading ? "Carregando..." : "Buscar"}
        </button>
      </section>

      {error ? <p className="error-message">{error}</p> : null}

      <section className="list-stack">
        {items.map((lead) => (
          <article className="lead-card" key={lead.id}>
            <div className="lead-main">
              <h2>{lead.studentName}</h2>
              <p>{lead.email}</p>
              <p>{lead.phoneE164}</p>
              <p>
                {lead.school} • {lead.city}
              </p>
            </div>
            <div className="lead-actions">
              <button className="button-whatsapp" onClick={() => void handleSendWhatsApp(lead.id)}>
                WhatsApp
              </button>
              <Link className="button-secondary" to={`/leads/${lead.id}`}>
                Detalhes
              </Link>
              <select
                value={lead.status}
                onChange={(e) => void handleStatusChange(lead.id, e.target.value as LeadStatus)}
              >
                {STATUS_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </article>
        ))}

        {!loading && items.length === 0 ? <p className="empty-state">Nenhum lead encontrado.</p> : null}
      </section>
    </main>
  );
}
