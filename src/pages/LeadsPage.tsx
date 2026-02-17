import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError, api } from "../lib/api";
import {
  caretFromDigitIndex,
  COUNTRIES,
  countDigitsBeforeCaret,
  countryDdiByIso2,
  countryFlagSvgUrlByIso2,
  digitsOnly,
  formatNationalPhoneByCountryIso2,
  formatLeadPhoneForDisplay,
  maxPhoneDigitsByCountryIso2,
  phonePlaceholderByCountryIso2,
  removeDigitAtIndex
} from "../lib/countries";
import { openWhatsApp } from "../lib/whatsapp";
import type { ImportPreviewResponse, Lead, LeadStatus } from "../types";

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
      return "bi bi-airplane-fill";
    case "LOST":
      return "bi bi-x-circle-fill";
    default:
      return "bi bi-tag-fill";
  }
}

export function LeadsPage() {
  const PAGE_SIZE = 30;
  const { session, logout } = useAuth();
  const [items, setItems] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<LeadStatus | "">("");
  const [totalFilteredLeads, setTotalFilteredLeads] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [canScrollPage, setCanScrollPage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreviewResponse | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [ignoreDuplicateOnCreate, setIgnoreDuplicateOnCreate] = useState(false);
  const [ignoreDuplicateOnImport, setIgnoreDuplicateOnImport] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "import">("create");
  const [currentPartnerName, setCurrentPartnerName] = useState("");
  const [formData, setFormData] = useState({
    student_name: "",
    email: "",
    phone_country: "BR",
    school: "",
    city: ""
  });
  const [rawPhoneDigits, setRawPhoneDigits] = useState("");
  const [createCountryIso2, setCreateCountryIso2] = useState("BR");
  const [createCountryOpen, setCreateCountryOpen] = useState(false);
  const autoSearchStarted = useRef(false);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);
  const createCountryPickerRef = useRef<HTMLDivElement | null>(null);
  const nextPhoneCaretRef = useRef<number | null>(null);

  const isMaster = session?.user.role === "MASTER";
  const effectivePartnerId = session?.user.partnerId ?? undefined;
  const userInfo = useMemo(() => {
    if (!session) return "";
    if (isMaster) {
      return "MASTER";
    }
    return currentPartnerName ? `PARTNER • ${currentPartnerName}` : "PARTNER";
  }, [currentPartnerName, isMaster, session]);

  const previewRows = useMemo(() => {
    if (!importPreview) return [];
    if (importPreview.preview_rows && importPreview.preview_rows.length > 0) {
      return importPreview.preview_rows;
    }
    return importPreview.preview_sample.map((row, index) => ({
      row_number: index + 2,
      ...row,
      is_duplicate: false,
      duplicate_fields: [] as Array<"phone" | "email" | "name">,
      error: null
    }));
  }, [importPreview]);

  const previewErrors = useMemo(() => {
    if (!importPreview) return [];
    return importPreview.errors_sample.filter((item) => !item.error.startsWith("DUPLICATE_LEAD:"));
  }, [importPreview]);

  const createPhonePlaceholder = useMemo(
    () => phonePlaceholderByCountryIso2(createCountryIso2),
    [createCountryIso2]
  );
  const createCountryDdi = useMemo(() => countryDdiByIso2(createCountryIso2), [createCountryIso2]);
  const createCountryFlagUrl = useMemo(
    () => countryFlagSvgUrlByIso2(createCountryIso2),
    [createCountryIso2]
  );
  const createPhoneMaskedValue = useMemo(
    () => formatNationalPhoneByCountryIso2(rawPhoneDigits, createCountryIso2),
    [rawPhoneDigits, createCountryIso2]
  );

  useEffect(() => {
    const maxDigits = maxPhoneDigitsByCountryIso2(createCountryIso2);
    if (rawPhoneDigits.length <= maxDigits) return;
    setRawPhoneDigits((current) => current.slice(0, maxDigits));
  }, [createCountryIso2, rawPhoneDigits.length]);

  useEffect(() => {
    if (nextPhoneCaretRef.current === null) return;
    const element = phoneInputRef.current;
    if (!element) return;
    const caret = nextPhoneCaretRef.current;
    nextPhoneCaretRef.current = null;
    window.requestAnimationFrame(() => {
      element.setSelectionRange(caret, caret);
    });
  }, [createPhoneMaskedValue]);

  function handlePhoneInputChange(value: string, selectionStart: number | null) {
    const maxDigits = maxPhoneDigitsByCountryIso2(createCountryIso2);
    const nextDigits = digitsOnly(value).slice(0, maxDigits);
    const caretDigitIndex = countDigitsBeforeCaret(value, selectionStart ?? value.length);
    setRawPhoneDigits(nextDigits);
    const masked = formatNationalPhoneByCountryIso2(nextDigits, createCountryIso2);
    nextPhoneCaretRef.current = caretFromDigitIndex(masked, Math.min(caretDigitIndex, nextDigits.length));
  }

  function handlePhoneKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const element = event.currentTarget;
    const selectionStart = element.selectionStart ?? 0;
    const selectionEnd = element.selectionEnd ?? selectionStart;
    if (selectionStart !== selectionEnd) return;

    const masked = createPhoneMaskedValue;
    const key = event.key;

    if (key === "Backspace" && selectionStart > 0) {
      const charBefore = masked[selectionStart - 1];
      if (charBefore && !/\d/.test(charBefore)) {
        event.preventDefault();
        const digitIndex = countDigitsBeforeCaret(masked, selectionStart);
        const nextDigits = removeDigitAtIndex(rawPhoneDigits, digitIndex - 1);
        const nextMasked = formatNationalPhoneByCountryIso2(nextDigits, createCountryIso2);
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
        const nextMasked = formatNationalPhoneByCountryIso2(nextDigits, createCountryIso2);
        setRawPhoneDigits(nextDigits);
        nextPhoneCaretRef.current = caretFromDigitIndex(nextMasked, digitIndex);
      }
    }
  }

  async function loadLeads(options?: { page?: number; append?: boolean }) {
    const page = options?.page ?? 1;
    const append = options?.append ?? false;

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const response = await api.getLeads({
        search: search.trim() || undefined,
        status: status || undefined,
        page,
        page_size: PAGE_SIZE
      });
      setItems((current) => (append ? [...current, ...response.items] : response.items));
      setTotalFilteredLeads(response.pagination.total);
      setCurrentPage(page);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Falha ao carregar leads");
      }
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadLeads({ page: 1 });
    if (!isMaster) {
      void loadCurrentPartner();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!autoSearchStarted.current) {
      autoSearchStarted.current = true;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadLeads({ page: 1 });
      setCurrentPage(1);
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  useEffect(() => {
    if (!createModalOpen) return;
    const currentOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = currentOverflow;
    };
  }, [createModalOpen]);

  useEffect(() => {
    if (!createCountryOpen) return;

    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (createCountryPickerRef.current?.contains(target)) return;
      setCreateCountryOpen(false);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [createCountryOpen]);

  useEffect(() => {
    function updateCanScrollPage() {
      const root = document.documentElement;
      setCanScrollPage(root.scrollHeight > root.clientHeight);
    }

    updateCanScrollPage();
    window.addEventListener("resize", updateCanScrollPage);
    return () => {
      window.removeEventListener("resize", updateCanScrollPage);
    };
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const root = document.documentElement;
      setCanScrollPage(root.scrollHeight > root.clientHeight);
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [items.length, loading, loadingMore, createModalOpen, previewModalOpen, error]);

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

  async function handleDeleteLead(leadId: string) {
    if (!isMaster) return;
    const confirmed = window.confirm("Deseja realmente excluir este lead?");
    if (!confirmed) return;

    try {
      await api.deleteLead(leadId);
      setItems((current) => current.filter((lead) => lead.id !== leadId));
      setTotalFilteredLeads((current) => Math.max(0, current - 1));
    } catch (err) {
      if (err instanceof ApiError) {
        alert(err.message);
      } else {
        alert("Erro ao excluir lead");
      }
    }
  }

  async function handleCreateLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!isMaster && !effectivePartnerId) {
      setFormError("Partner do usuario nao encontrado.");
      return;
    }

    setCreateLoading(true);
    try {
      await api.createLead({
        partner_id: isMaster ? undefined : effectivePartnerId,
        ignore_duplicates: ignoreDuplicateOnCreate,
        ...formData,
        phone_country: createCountryIso2,
        phone_national: rawPhoneDigits
      });
      setFormData({
        student_name: "",
        email: "",
        phone_country: "BR",
        school: "",
        city: ""
      });
      setRawPhoneDigits("");
      setCreateCountryIso2("BR");
      setCreateModalOpen(false);
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

    if (!isMaster && !effectivePartnerId) {
      setImportError("Partner do usuario nao encontrado.");
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
        partner_id: isMaster ? undefined : effectivePartnerId
      });
      setImportPreview(preview);
      setPreviewModalOpen(true);
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
    if (importPreview.duplicate_rows > 0 && !ignoreDuplicateOnImport) {
      setImportError(
        "Existem leads duplicados no preview. Marque para ignorar duplicados antes de confirmar."
      );
      return;
    }
    setConfirmLoading(true);
    setImportError(null);
    try {
      const result = await api.confirmImport(importPreview.import_id, {
        ignore_duplicates: ignoreDuplicateOnImport
      });
      await loadLeads();
      alert(
        `Importacao ${result.status}: ${result.success_rows} sucesso(s), ${result.error_rows} erro(s).`
      );
      setImportPreview(null);
      setImportFile(null);
      setPreviewModalOpen(false);
      setCreateModalOpen(false);
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

  function handleCloseCreateModal() {
    setCreateModalOpen(false);
    setPreviewModalOpen(false);
    setImportPreview(null);
    setImportError(null);
    setIgnoreDuplicateOnCreate(false);
    setIgnoreDuplicateOnImport(true);
    setRawPhoneDigits("");
    setCreateCountryIso2("BR");
    setCreateCountryOpen(false);
  }

  function handleSearchClick() {
    setCurrentPage(1);
    void loadLeads({ page: 1 });
  }

  function handleLoadMore() {
    if (loadingMore || loading) return;
    void loadLeads({ page: currentPage + 1, append: true });
  }

  function handleBackToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleExportLeads() {
    setExportLoading(true);
    try {
      const blob = await api.exportLeadsXlsx({
        search: search.trim() || undefined,
        status: status || undefined
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `leads-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      if (err instanceof ApiError) {
        alert(err.message);
      } else {
        alert("Erro ao exportar leads");
      }
    } finally {
      setExportLoading(false);
    }
  }

  return (
    <main className="page-shell">
      <header className="topbar">
        <div>
          <h1>Leads</h1>
          <p>{userInfo}</p>
        </div>
        <button className="button-secondary header-logout-btn" onClick={() => void logout()}>
          <i className="bi bi-box-arrow-right" aria-hidden="true" /> Sair
        </button>
      </header>

      <section className="card">
        <div className="search-row">
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
                {statusLabel(item)}
              </option>
            ))}
          </select>
          <button className="button-primary" onClick={handleSearchClick} disabled={loading}>
            {loading ? (
              "Carregando..."
            ) : (
              <>
                <i className="bi bi-search" aria-hidden="true" /> Buscar
              </>
            )}
          </button>
        </div>
        <div className="action-row action-row-three">
          <button
            className="button-secondary"
            onClick={() => {
              setModalMode("create");
              setCreateModalOpen(true);
            }}
          >
            <i className="bi bi-person-plus" aria-hidden="true" /> Novo lead
          </button>
          <button
            className="button-secondary"
            onClick={() => {
              setModalMode("import");
              setCreateModalOpen(true);
            }}
          >
            <i className="bi bi-file-earmark-excel" aria-hidden="true" />
            <span>Importar XLSX</span>
          </button>
          <button className="button-secondary" onClick={() => void handleExportLeads()} disabled={exportLoading}>
            {exportLoading ? (
              "Exportando..."
            ) : (
              <>
                <i className="bi bi-file-earmark-excel-fill" aria-hidden="true" /> Exportar XLSX
              </>
            )}
          </button>
        </div>
        <p className="results-info">
          Mostrando {items.length} de {totalFilteredLeads} leads
        </p>
      </section>

      {error ? <p className="error-message">{error}</p> : null}

      {createModalOpen ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <section className="modal-card">
            <div className="modal-header">
              <h2>{modalMode === "create" ? "Adicionar lead" : "Importar planilha"}</h2>
              <button
                className="button-secondary header-logout-btn"
                onClick={handleCloseCreateModal}
              >
                <i className="bi bi-arrow-left" aria-hidden="true" /> Voltar
              </button>
            </div>

            {modalMode === "create" ? (
              <form className="form-stack" onSubmit={handleCreateLead}>
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

                <div className="form-row">
                  <span className="field-label">Telefone</span>
                  <div className="phone-inline-group">
                    <div
                      className={`country-picker phone-inline-country${createCountryOpen ? " is-open" : ""}`}
                      ref={createCountryPickerRef}
                    >
                      <button
                        type="button"
                        className="country-picker-summary"
                        style={{ backgroundImage: `url(${createCountryFlagUrl})` }}
                        aria-label="Pais"
                        aria-expanded={createCountryOpen}
                        onClick={() => setCreateCountryOpen((current) => !current)}
                      />
                      {createCountryOpen ? (
                        <div className="country-picker-menu">
                        {COUNTRIES.map((country) => (
                          <button
                            key={country.iso2}
                            type="button"
                            className="country-picker-item"
                            onClick={() => {
                              setCreateCountryIso2(country.iso2);
                              setCreateCountryOpen(false);
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
                      value={createCountryDdi}
                      readOnly
                      aria-label="Codigo do pais"
                    />
                    <input
                      className="phone-inline-number"
                      placeholder={createPhonePlaceholder}
                      ref={phoneInputRef}
                      value={createPhoneMaskedValue}
                      onKeyDown={handlePhoneKeyDown}
                      onChange={(e) => handlePhoneInputChange(e.target.value, e.target.selectionStart)}
                      aria-label="Telefone nacional"
                      required
                    />
                  </div>
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

                <label className="checkbox-line">
                  <input
                    type="checkbox"
                    checked={ignoreDuplicateOnCreate}
                    onChange={(e) => setIgnoreDuplicateOnCreate(e.target.checked)}
                  />
                  Ignorar duplicidade e adicionar mesmo assim
                </label>

                {formError ? <p className="error-message">{formError}</p> : null}
                <button type="submit" className="button-primary" disabled={createLoading}>
                  {createLoading ? (
                    "Criando..."
                  ) : (
                    <>
                      <i className="bi bi-person-plus" aria-hidden="true" /> Adicionar lead
                    </>
                  )}
                </button>
              </form>
            ) : null}

            {modalMode === "import" ? (
              <>
                <form className="form-stack" onSubmit={handleImportPreview}>
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
                    {previewLoading ? (
                      "Processando..."
                    ) : (
                      <>
                        <i className="bi bi-file-earmark-text" aria-hidden="true" /> Gerar preview
                      </>
                    )}
                  </button>
                </form>
              </>
            ) : null}
          </section>
        </div>
      ) : null}

      {previewModalOpen && importPreview ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <section className="modal-card preview-table-modal">
            <div className="modal-header">
              <h2>Preview da importação</h2>
              <button className="button-secondary header-logout-btn" onClick={() => setPreviewModalOpen(false)}>
                <i className="bi bi-arrow-left" aria-hidden="true" /> Voltar
              </button>
            </div>

            <p>
              Total: {importPreview.total_rows} | Válidas: {importPreview.valid_rows} | Inválidas:{" "}
              {importPreview.invalid_rows}
            </p>

            <div className="preview-table-wrap">
              <table className="preview-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Email</th>
                    <th>Telefone</th>
                    <th>Escola</th>
                    <th>Cidade</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => (
                    <tr
                      key={`${row.row_number}-${row.email}-${row.phone}`}
                      className={row.is_duplicate ? "preview-row-duplicate" : row.error ? "preview-row-error" : ""}
                      title={row.error ?? undefined}
                    >
                      <td className={row.duplicate_fields.includes("name") ? "preview-cell-duplicate" : ""}>
                        {row.student_name}
                      </td>
                      <td className={row.duplicate_fields.includes("email") ? "preview-cell-duplicate" : ""}>
                        {row.email}
                      </td>
                      <td className={row.duplicate_fields.includes("phone") ? "preview-cell-duplicate" : ""}>
                        {row.phone}
                      </td>
                      <td>{row.school}</td>
                      <td>{row.city}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="preview-legend">
              <span className="preview-legend-item">
                <span className="preview-legend-swatch preview-legend-swatch-duplicate-row" />
                Linha com lead duplicado
              </span>
              <span className="preview-legend-item">
                <span className="preview-legend-swatch preview-legend-swatch-duplicate-cell" />
                Campo que causou duplicidade (nome, email ou telefone)
              </span>
              <span className="preview-legend-item">
                <span className="preview-legend-swatch preview-legend-swatch-error-row" />
                Linha inválida por validação
              </span>
            </div>

            {previewErrors.length > 0 ? (
              <div className="timeline">
                {previewErrors.map((item) => (
                  <article className="timeline-item" key={`${item.row_number}-${item.error}`}>
                    <p>Linha {item.row_number}</p>
                    <p>{item.error}</p>
                  </article>
                ))}
              </div>
            ) : null}

            {importPreview.duplicate_rows > 0 ? (
              <label className="checkbox-line">
                <input
                  type="checkbox"
                  checked={ignoreDuplicateOnImport}
                  onChange={(e) => setIgnoreDuplicateOnImport(e.target.checked)}
                />
                Ignorar {importPreview.duplicate_rows} leads duplicados e adicionar apenas novos
              </label>
            ) : null}

            {importError ? <p className="error-message">{importError}</p> : null}

            <button
              className="button-whatsapp header-logout-btn preview-confirm-btn"
              onClick={() => void handleConfirmImport()}
              disabled={confirmLoading}
            >
              {confirmLoading ? "Confirmando..." : "Confirmar e adicionar leads"}
            </button>
          </section>
        </div>
      ) : null}

      <section className="list-stack">
        {items.map((lead) => (
          <article className={`lead-card lead-card-status-${lead.status.toLowerCase()}`} key={lead.id}>
            <div className="lead-main">
              <h2>{lead.studentName}</h2>
              <span
                className={`${statusBadgeClass(lead.status)} status-badge-corner`}
                title={statusLabel(lead.status)}
                aria-label={statusLabel(lead.status)}
              >
                <i className={statusIconClass(lead.status)} aria-hidden="true" />
              </span>
              <p>{lead.email}</p>
              <p>{formatLeadPhoneForDisplay(lead.phoneE164, lead.phoneCountry)}</p>
              <p>
                {lead.school} • {lead.city}
              </p>
            </div>
            <div className="lead-actions">
              <div className="lead-action-row">
                <button
                  className="icon-action-btn button-whatsapp"
                  onClick={() => void handleSendWhatsApp(lead.id)}
                  disabled={!isMaster}
                  title={isMaster ? "WhatsApp" : "Apenas MASTER"}
                >
                  <i className="bi bi-whatsapp" aria-hidden="true" />
                </button>

                <Link className="icon-action-btn button-secondary" to={`/leads/${lead.id}`} title="Detalhes">
                  <i className="bi bi-person-lines-fill" aria-hidden="true" />
                </Link>

                {isMaster ? (
                  <details className="status-picker">
                    <summary className="icon-action-btn button-secondary" title="Etiqueta">
                      <i className="bi bi-tag-fill" aria-hidden="true" />
                    </summary>
                    <div className="status-menu">
                      {STATUS_OPTIONS.map((item) => (
                        <button
                          key={item}
                          className="status-menu-item"
                          onClick={(e) => {
                            e.preventDefault();
                            void handleStatusChange(lead.id, item);
                            const details = (e.currentTarget.closest("details") as HTMLDetailsElement | null);
                            if (details) details.open = false;
                          }}
                        >
                          {statusLabel(item)}
                        </button>
                      ))}
                    </div>
                  </details>
                ) : (
                  <button className="icon-action-btn button-secondary" disabled title="Apenas MASTER">
                    <i className="bi bi-tag-fill" aria-hidden="true" />
                  </button>
                )}

                <button
                  className="icon-action-btn button-danger"
                  onClick={() => void handleDeleteLead(lead.id)}
                  disabled={!isMaster}
                  title={isMaster ? "Excluir" : "Apenas MASTER"}
                >
                  <i className="bi bi-trash-fill" aria-hidden="true" />
                </button>
              </div>
            </div>
          </article>
        ))}

        {!loading && items.length === 0 ? <p className="empty-state">Nenhum lead encontrado.</p> : null}
      </section>

      {!loading && items.length < totalFilteredLeads ? (
        <section className="card">
          <button className="button-primary" onClick={handleLoadMore} disabled={loadingMore}>
            {loadingMore ? "Carregando..." : "Carregar mais"}
          </button>
        </section>
      ) : null}

      {canScrollPage ? (
        <section className="card">
          <button className="button-secondary" onClick={handleBackToTop}>
            <i className="bi bi-arrow-up" aria-hidden="true" /> Voltar ao topo
          </button>
        </section>
      ) : null}
    </main>
  );
}
