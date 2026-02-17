import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError, api } from "../lib/api";
import {
  caretFromDigitIndex,
  COUNTRIES,
  countDigitsBeforeCaret,
  countryDdiByIso2,
  countryFlagSvgUrlByIso2,
  digitsOnly,
  formatLeadPhoneForDisplay,
  formatNationalPhoneByCountryIso2,
  maxPhoneDigitsByCountryIso2,
  nationalDigitsFromE164,
  phonePlaceholderByCountryIso2,
  removeDigitAtIndex
} from "../lib/countries";
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
      return "Primeiro contato efetuado";
    case "NO_RESPONSE":
      return "Sem resposta";
    case "NEW":
      return "Novo Lead";
    case "RESPONDED":
      return "Primeiro contato respondido";
    case "WON":
      return "Lead fechado";
    case "LOST":
      return "Ja comprou ou nao retornou";
    default:
      return status;
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}

export function LeadDetailPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const [lead, setLead] = useState<Lead | null>(null);
  const [statusHistory, setStatusHistory] = useState<LeadStatusHistoryItem[]>([]);
  const [contactEvents, setContactEvents] = useState<ContactEventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editData, setEditData] = useState({
    student_name: "",
    email: "",
    school: "",
    city: ""
  });
  const [editCountryIso2, setEditCountryIso2] = useState("BR");
  const [editCountryOpen, setEditCountryOpen] = useState(false);
  const [rawPhoneDigits, setRawPhoneDigits] = useState("");
  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const editCountryPickerRef = useRef<HTMLDivElement | null>(null);
  const nextPhoneCaretRef = useRef<number | null>(null);
  const isMaster = session?.user.role === "MASTER";

  const editCountryDdi = useMemo(() => countryDdiByIso2(editCountryIso2), [editCountryIso2]);
  const editCountryFlagUrl = useMemo(() => countryFlagSvgUrlByIso2(editCountryIso2), [editCountryIso2]);
  const editPhonePlaceholder = useMemo(
    () => phonePlaceholderByCountryIso2(editCountryIso2),
    [editCountryIso2]
  );
  const editPhoneMaskedValue = useMemo(
    () => formatNationalPhoneByCountryIso2(rawPhoneDigits, editCountryIso2),
    [rawPhoneDigits, editCountryIso2]
  );
  const editPhoneFullDisplay = useMemo(() => {
    if (!editPhoneMaskedValue) return "";
    return `${editCountryDdi} ${editPhoneMaskedValue}`.trim();
  }, [editCountryDdi, editPhoneMaskedValue]);

  useEffect(() => {
    const maxDigits = maxPhoneDigitsByCountryIso2(editCountryIso2);
    if (rawPhoneDigits.length <= maxDigits) return;
    setRawPhoneDigits((current) => current.slice(0, maxDigits));
  }, [editCountryIso2, rawPhoneDigits.length]);

  useEffect(() => {
    if (nextPhoneCaretRef.current === null) return;
    const element = phoneInputRef.current;
    if (!element) return;
    const caret = nextPhoneCaretRef.current;
    nextPhoneCaretRef.current = null;
    window.requestAnimationFrame(() => {
      element.setSelectionRange(caret, caret);
    });
  }, [editPhoneMaskedValue]);

  function handlePhoneInputChange(value: string, selectionStart: number | null) {
    const maxDigits = maxPhoneDigitsByCountryIso2(editCountryIso2);
    const nextDigits = digitsOnly(value).slice(0, maxDigits);
    const caretDigitIndex = countDigitsBeforeCaret(value, selectionStart ?? value.length);
    setRawPhoneDigits(nextDigits);
    const masked = formatNationalPhoneByCountryIso2(nextDigits, editCountryIso2);
    nextPhoneCaretRef.current = caretFromDigitIndex(masked, Math.min(caretDigitIndex, nextDigits.length));
  }

  function handlePhoneKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const element = event.currentTarget;
    const selectionStart = element.selectionStart ?? 0;
    const selectionEnd = element.selectionEnd ?? selectionStart;
    if (selectionStart !== selectionEnd) return;

    const masked = editPhoneMaskedValue;
    const key = event.key;

    if (key === "Backspace" && selectionStart > 0) {
      const charBefore = masked[selectionStart - 1];
      if (charBefore && !/\d/.test(charBefore)) {
        event.preventDefault();
        const digitIndex = countDigitsBeforeCaret(masked, selectionStart);
        const nextDigits = removeDigitAtIndex(rawPhoneDigits, digitIndex - 1);
        const nextMasked = formatNationalPhoneByCountryIso2(nextDigits, editCountryIso2);
        setRawPhoneDigits(nextDigits);
        nextPhoneCaretRef.current = caretFromDigitIndex(nextMasked, Math.max(0, digitIndex - 1));
      }
    }

    if (key === "Delete" && selectionStart < masked.length) {
      const charAtCaret = masked[selectionStart];
      if (charAtCaret && !/\d/.test(charAtCaret)) {
        event.preventDefault();
        const digitIndex = countDigitsBeforeCaret(masked, selectionStart);
        const nextDigits = removeDigitAtIndex(rawPhoneDigits, digitIndex);
        const nextMasked = formatNationalPhoneByCountryIso2(nextDigits, editCountryIso2);
        setRawPhoneDigits(nextDigits);
        nextPhoneCaretRef.current = caretFromDigitIndex(nextMasked, digitIndex);
      }
    }
  }

  async function loadLeadDetail() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [leadResponse, historyResponse] = await Promise.all([api.getLeadById(id), api.getLeadHistory(id)]);
      setLead(leadResponse);
      setEditData({
        student_name: leadResponse.studentName,
        email: leadResponse.email,
        school: leadResponse.school,
        city: leadResponse.city
      });
      setEditCountryIso2(
        COUNTRIES.some((country) => country.iso2 === leadResponse.phoneCountry) ? leadResponse.phoneCountry : "BR"
      );
      setRawPhoneDigits(nationalDigitsFromE164(leadResponse.phoneE164, leadResponse.phoneCountry));
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

  useEffect(() => {
    if (!editCountryOpen) return;

    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (editCountryPickerRef.current?.contains(target)) return;
      setEditCountryOpen(false);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [editCountryOpen]);

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

  async function handleSaveLead() {
    if (!id) return;
    setSaving(true);
    setSaveSuccess(null);
    try {
      await api.updateLead(id, {
        ...editData,
        phone_country: editCountryIso2,
        phone_national: rawPhoneDigits
      });
      await loadLeadDetail();
      setSaveSuccess("Dados alterados com sucesso.");
    } catch (err) {
      if (err instanceof ApiError) {
        alert(err.message);
      } else {
        alert("Erro ao salvar lead");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteLead() {
    if (!id || !isMaster) return;
    const confirmed = window.confirm("Deseja realmente excluir este lead?");
    if (!confirmed) return;
    setDeleting(true);
    try {
      await api.deleteLead(id);
      navigate("/leads");
    } catch (err) {
      if (err instanceof ApiError) {
        alert(err.message);
      } else {
        alert("Erro ao excluir lead");
      }
    } finally {
      setDeleting(false);
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
        <div className="detail-header-actions">
          {isMaster ? (
            <button
              className="button-danger detail-header-icon-btn"
              onClick={() => void handleDeleteLead()}
              disabled={deleting}
              title={deleting ? "Excluindo..." : "Excluir"}
              aria-label="Excluir"
            >
              <i className="bi bi-trash-fill" aria-hidden="true" />
            </button>
          ) : null}
          {isMaster ? (
            <button
              className="button-whatsapp detail-header-icon-btn"
              onClick={() => void handleSendWhatsApp()}
              title="WhatsApp"
              aria-label="WhatsApp"
            >
              <i className="bi bi-whatsapp" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </header>

      <section className="card lead-detail-card">
        <h1>Editar lead</h1>
        <label>
          Nome do estudante
          <input
            value={editData.student_name}
            onChange={(e) => setEditData((prev) => ({ ...prev, student_name: e.target.value }))}
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={editData.email}
            onChange={(e) => setEditData((prev) => ({ ...prev, email: e.target.value }))}
          />
        </label>
        <div className="form-row">
          <span className="field-label">Telefone</span>
          <div className="phone-inline-group">
            <div
              className={`country-picker phone-inline-country${editCountryOpen ? " is-open" : ""}`}
              ref={editCountryPickerRef}
            >
              <button
                type="button"
                className="country-picker-summary"
                style={{ backgroundImage: `url(${editCountryFlagUrl})` }}
                aria-label="Pais"
                aria-expanded={editCountryOpen}
                onClick={() => setEditCountryOpen((current) => !current)}
              />
              {editCountryOpen ? (
                <div className="country-picker-menu">
                  {COUNTRIES.map((country) => (
                    <button
                      key={country.iso2}
                      type="button"
                      className="country-picker-item"
                      onClick={() => {
                        setEditCountryIso2(country.iso2);
                        setEditCountryOpen(false);
                      }}
                    >
                      <span>{country.flag}</span>
                      <span>{country.name}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <input
              className="phone-inline-ddi"
              value={editCountryDdi}
              readOnly
              aria-label="Codigo do pais"
            />
            <input
              className="phone-inline-number"
              placeholder={editPhonePlaceholder}
              ref={phoneInputRef}
              value={editPhoneMaskedValue}
              onKeyDown={handlePhoneKeyDown}
              onChange={(e) => handlePhoneInputChange(e.target.value, e.target.selectionStart)}
              aria-label="Telefone nacional"
            />
          </div>
        </div>
        <p className="helper-text">
          {editPhoneFullDisplay || formatLeadPhoneForDisplay(lead.phoneE164, lead.phoneCountry)}
        </p>
        <label>
          Escola
          <input
            value={editData.school}
            onChange={(e) => setEditData((prev) => ({ ...prev, school: e.target.value }))}
          />
        </label>
        <label>
          Cidade
          <input
            value={editData.city}
            onChange={(e) => setEditData((prev) => ({ ...prev, city: e.target.value }))}
          />
        </label>
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
        <button className="button-primary" onClick={() => void handleSaveLead()} disabled={saving}>
          {saving ? (
            "Salvando..."
          ) : (
            <>
              <i className="bi bi-floppy-fill" aria-hidden="true" /> Salvar alterações
            </>
          )}
        </button>
        {saveSuccess ? <p className="helper-text">{saveSuccess}</p> : null}
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
