import { useEffect, useMemo, useState } from "react";
import "./Customers.css";
import {
  searchCustomers,
  getCustomer,
  updateCustomer,
  createCustomer,
} from "../../utils/api";
import { useToast } from "../Toast/Toast";

const EMPTY_FORM = {
  type: "homeowner",
  name: "",
  companyName: "",
  phone: "",
  email: "",
};

export default function Customers() {
  const token = useMemo(() => localStorage.getItem("jwt"), []);
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  // NEW: "edit" | "create"
  const [mode, setMode] = useState("edit");

  const [form, setForm] = useState(EMPTY_FORM);

  const [status, setStatus] = useState({
    loading: false,
    saving: false,
    error: "",
  });

  async function loadList(q) {
    if (!token) return;
    setStatus((s) => ({ ...s, loading: true, error: "" }));
    try {
      const res = await searchCustomers(token, q);
      setCustomers(Array.isArray(res?.customers) ? res.customers : []);
    } catch (e) {
      setStatus((s) => ({
        ...s,
        error: e?.message || "Failed to load customers",
      }));
      setCustomers([]);
    } finally {
      setStatus((s) => ({ ...s, loading: false }));
    }
  }

  async function loadOne(id) {
    if (!token || !id) return;
    setStatus((s) => ({ ...s, error: "" }));
    try {
      const res = await getCustomer(token, id);
      const c = res?.customer;
      if (!c) return;

      setForm({
        type: c.type || "homeowner",
        name: c.name || "",
        companyName: c.companyName || "",
        phone: c.phone || "",
        email: c.email || "",
      });
    } catch (e) {
      setStatus((s) => ({
        ...s,
        error: e?.message || "Failed to load customer",
      }));
    }
  }

  useEffect(() => {
    loadList("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => loadList(query.trim()), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    if (selectedId) {
      setMode("edit");
      loadOne(selectedId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const toast = useToast();

  function startCreate() {
    setStatus((s) => ({ ...s, error: "" }));
    setSelectedId(null);
    setMode("create");
    setForm(EMPTY_FORM);
  }

  function startEdit(id) {
    setStatus((s) => ({ ...s, error: "" }));
    setMode("edit");
    setSelectedId(id);
  }

  function onCancelCreate() {
    setStatus((s) => ({ ...s, error: "" }));
    setMode("edit");
    setForm(EMPTY_FORM);
    // do not auto-select anything; user can click a row
  }

  async function onSaveEdit() {
    if (!selectedId) return;

    if (!String(form.name || "").trim()) {
      setStatus((s) => ({ ...s, error: "Name is required." }));
      return;
    }

    setStatus((s) => ({ ...s, saving: true, error: "" }));
    try {
      await updateCustomer(token, selectedId, {
        type: form.type,
        name: String(form.name).trim(),
        companyName: form.companyName || null,
        phone: form.phone || null,
        email: form.email || null,
      });

      await loadList(query.trim());
    } catch (e) {
      setStatus((s) => ({
        ...s,
        error: e?.message || "Failed to save customer",
      }));
    } finally {
      setStatus((s) => ({ ...s, saving: false }));
      toast.success("Customer saved");
    }
  }

  async function onCreate() {
    if (!token) return;

    if (!String(form.name || "").trim()) {
      setStatus((s) => ({ ...s, error: "Name is required." }));
      return;
    }

    setStatus((s) => ({ ...s, saving: true, error: "" }));
    try {
      const res = await createCustomer(token, {
        type: form.type,
        name: String(form.name).trim(),
        companyName: form.companyName || null,
        phone: form.phone || null,
        email: form.email || null,
      });

      const created = res?.customer;

      await loadList(query.trim());

      // If backend returns the created customer, auto-select it for editing
      if (created?._id) {
        setSelectedId(created._id);
        setMode("edit");
      } else {
        // fallback: stay in create mode but clear form
        setForm(EMPTY_FORM);
      }
    } catch (e) {
      setStatus((s) => ({
        ...s,
        error: e?.message || "Failed to create customer",
      }));
    } finally {
      setStatus((s) => ({ ...s, saving: false }));
    }
  }

  const isCreating = mode === "create";
  const showForm = isCreating || !!selectedId;

  return (
    <div className="customers">
      <div className="customers__header">
        <h2 className="customers__title">Customers</h2>

        {/* Placeholder for future Jobber import */}
        <button
          type="button"
          className="customers__button customers__button_cancel"
          disabled
          title="Coming soon"
        >
          Import from Jobber (soon)
        </button>
      </div>

      <div className="customers__grid">
        <div className="customers__panel">
          <div className="customers__toprow">
            <input
              className="customers__search customers__input"
              placeholder="Search customers…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            <button
              type="button"
              className="customers__button customers__button_create"
              onClick={startCreate}
            >
              + New Customer
            </button>
          </div>

          {status.loading ? (
            <div className="customers__hint">Loading…</div>
          ) : (
            <div className="customers__list">
              {customers.map((c) => (
                <button
                  key={c._id}
                  type="button"
                  className={
                    selectedId === c._id && !isCreating
                      ? "customers__row customers__row_active"
                      : "customers__row"
                  }
                  onClick={() => startEdit(c._id)}
                >
                  <div className="customers__row_name">{c.name}</div>
                  <div className="customers__row_sub">
                    {c.type
                      ? `${c.type.charAt(0).toUpperCase() + c.type.slice(1)}`
                      : ""}
                    {c.companyName ? ` • ${c.companyName}` : ""}
                  </div>
                </button>
              ))}
              {customers.length === 0 && (
                <div className="customers__hint">No customers found.</div>
              )}
            </div>
          )}
        </div>

        <div className="customers__panel">
          {!showForm ? (
            <div className="customers__hint">
              Select a customer to edit, or click <b>+ New Customer</b>.
            </div>
          ) : (
            <>
              <div className="customers__form">
                <div className="customers__formTitle">
                  {isCreating ? "Create Customer" : "Edit Customer"}
                </div>

                <label className="customers__label">
                  Type
                  <select
                    className="customers__input"
                    value={form.type}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, type: e.target.value }))
                    }
                  >
                    <option value="homeowner">Homeowner</option>
                    <option value="builder">Builder</option>
                  </select>
                </label>

                <label className="customers__label">
                  Name *
                  <input
                    className="customers__input"
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                  />
                </label>

                <label className="customers__label">
                  Company Name
                  <input
                    className="customers__input"
                    value={form.companyName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, companyName: e.target.value }))
                    }
                  />
                </label>

                <label className="customers__label">
                  Phone
                  <input
                    className="customers__input"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                  />
                </label>

                <label className="customers__label">
                  Email
                  <input
                    className="customers__input"
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                  />
                </label>

                {status.error && (
                  <div className="customers__error">{status.error}</div>
                )}

                <div className="customers__actions">
                  {isCreating ? (
                    <>
                      <button
                        type="button"
                        className="customers__button customers__button_cancel"
                        onClick={onCancelCreate}
                        disabled={status.saving}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="customers__button customers__button_create"
                        onClick={onCreate}
                        disabled={status.saving}
                      >
                        {status.saving ? "Creating…" : "Create"}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="customers__button customers__button_create"
                      onClick={onSaveEdit}
                      disabled={status.saving}
                    >
                      {status.saving ? "Saving…" : "Save"}
                    </button>
                  )}
                </div>
              </div>

              <div className="customers__hint">
                Changes here will reflect immediately when you search/select
                customers in “Create Project”.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
