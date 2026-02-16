import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError, api } from "../lib/api";
import { openWhatsApp } from "../lib/whatsapp";
import type { ImportPreviewResponse, Lead, LeadStatus, Partner } from "../types";

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
  const [partners, setPartners] = useState<Partner[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<LeadStatus | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreviewResponse | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [currentPartnerName, setCurrentPartnerName] = useState("");
  const [formData, setFormData] = useState({
    student_name: "",
    email: "",
    phone_country: "BR",
    phone_national: "",
    school: "",
    city: ""
  });

  const isMaster = session?.user.role === "MASTER";
  const effectivePartnerId = isMaster ? selectedPartnerId : (session?.user.partnerId ?? "");
  const selectedPartnerName = useMemo(
    () => partners.find((partner) => partner.id === selectedPartnerId)?.name ?? "",
    [partners, selectedPartnerId]
  );
  const userInfo = useMemo(() => {
    if (!session) return "";
    if (isMaster) {
      return selectedPartnerName ? `MASTER • ${selectedPartnerName}` : "MASTER";
    }
    return currentPartnerName ? `PARTNER • ${currentPartnerName}` : "PARTNER";
  }, [currentPartnerName, isMaster, selectedPartnerName, session]);

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
    if (isMaster) {
      void loadPartners();
    } else {
      void loadCurrentPartner();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPartners() {
    try {
      const list = await api.getPartners();
      setPartners(list);
      if (!selectedPartnerId && list.length > 0) {
        setSelectedPartnerId(list[0].id);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Falha ao carregar partners");
      }
    }
  }

  async function loadCurrentPartner() {
    try {
      const partner = await api.getCurrentPartner();
      setCurrentPartnerName(partner.name);
    } catch {
      setCurrentPartnerName("");
    }
  }

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

  async function handleCreateLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!effectivePartnerId) {
      setFormError("Selecione um partner para criar o lead.");
      return;
    }

    setCreateLoading(true);
    try {
      await api.createLead({
        partner_id: effectivePartnerId,
        ...formData
      });
      setFormData({
        student_name: "",
        email: "",
        phone_country: "BR",
        phone_national: "",
        school: "",
        city: ""
      });
      await loadLeads();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError("Erro ao criar lead");
      }
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleImportPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setImportError(null);

    if (!effectivePartnerId) {
      setImportError("Selecione um partner para importar.");
      return;
    }
    if (!importFile) {
      setImportError("Selecione um arquivo .xls ou .xlsx.");
      return;
    }

    setPreviewLoading(true);
    try {
      const preview = await api.previewImportXls({
        file: importFile,
        partner_id: effectivePartnerId
      });
      setImportPreview(preview);
    } catch (err) {
      if (err instanceof ApiError) {
        setImportError(err.message);
      } else {
        setImportError("Erro ao processar preview da importacao");
      }
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleConfirmImport() {
    if (!importPreview) return;
    setConfirmLoading(true);
    setImportError(null);
    try {
      const result = await api.confirmImport(importPreview.import_id);
      await loadLeads();
      alert(
        `Importacao ${result.status}: ${result.success_rows} sucesso(s), ${result.error_rows} erro(s).`
      );
      setImportPreview(null);
      setImportFile(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setImportError(err.message);
      } else {
        setImportError("Erro ao confirmar importacao");
      }
    } finally {
      setConfirmLoading(false);
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
          <i className="bi bi-box-arrow-right" aria-hidden="true" /> Sair
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

      <section className="card">
        <h2>Criar lead manualmente</h2>
        <form className="form-stack" onSubmit={handleCreateLead}>
          {isMaster ? (
            <label>
              Partner
              <select
                value={selectedPartnerId}
                onChange={(e) => setSelectedPartnerId(e.target.value)}
                required
              >
                <option value="">Selecione o partner</option>
                {partners.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label>
            Nome do estudante
            <input
              value={formData.student_name}
              onChange={(e) => setFormData((prev) => ({ ...prev, student_name: e.target.value }))}
              required
            />
          </label>

          <label>
            Email
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
              required
            />
          </label>

          <div className="form-grid-two">
            <label>
              País (ISO2)
              <input
                value={formData.phone_country}
                maxLength={2}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    phone_country: e.target.value.toUpperCase()
                  }))
                }
                required
              />
            </label>
            <label>
              Telefone nacional
              <input
                value={formData.phone_national}
                onChange={(e) => setFormData((prev) => ({ ...prev, phone_national: e.target.value }))}
                required
              />
            </label>
          </div>

          <label>
            Escola
            <input
              value={formData.school}
              onChange={(e) => setFormData((prev) => ({ ...prev, school: e.target.value }))}
              required
            />
          </label>

          <label>
            Cidade
            <input
              value={formData.city}
              onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
              required
            />
          </label>

          {formError ? <p className="error-message">{formError}</p> : null}
          <button type="submit" className="button-primary" disabled={createLoading}>
            {createLoading ? "Criando..." : "Criar lead"}
          </button>
        </form>
      </section>

      <section className="card">
        <h2>Importar planilha (.xls/.xlsx)</h2>
        <p className="helper-text">
          Colunas obrigatórias: student_name, email, phone (E.164 com +), school, city.
        </p>
        <form className="form-stack" onSubmit={handleImportPreview}>
          {isMaster ? (
            <label>
              Partner para importação
              <select
                value={selectedPartnerId}
                onChange={(e) => setSelectedPartnerId(e.target.value)}
                required
              >
                <option value="">Selecione o partner</option>
                {partners.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label>
            Arquivo
            <input
              type="file"
              accept=".xls,.xlsx"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              required
            />
          </label>

          {importError ? <p className="error-message">{importError}</p> : null}
          <button type="submit" className="button-primary" disabled={previewLoading}>
            {previewLoading ? "Processando..." : "Gerar preview"}
          </button>
        </form>

        {importPreview ? (
          <div className="import-preview">
            <p>
              Total: {importPreview.total_rows} | Válidas: {importPreview.valid_rows} | Inválidas:{" "}
              {importPreview.invalid_rows}
            </p>
            {importPreview.errors_sample.length > 0 ? (
              <div className="timeline">
                {importPreview.errors_sample.map((item) => (
                  <article className="timeline-item" key={`${item.row_number}-${item.error}`}>
                    <p>Linha {item.row_number}</p>
                    <p>{item.error}</p>
                  </article>
                ))}
              </div>
            ) : null}
            <button className="button-whatsapp" onClick={() => void handleConfirmImport()} disabled={confirmLoading}>
              {confirmLoading ? "Confirmando..." : "Confirmar importação"}
            </button>
          </div>
        ) : null}
      </section>

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
