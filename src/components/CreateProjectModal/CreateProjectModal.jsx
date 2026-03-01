import { useEffect, useMemo, useState } from "react";
import "./CreateProjectModal.css";
import dropdown from "../../assets/icons/drop-down.svg";
import { createCustomer, searchCustomers } from "../../utils/api";
import { useNavigate } from "react-router-dom";

export default function CreateProjectModal({
  isOpen,
  closeModal,
  handleCreateProjectSubmitClick,
}) {
  // Project
  const [projectName, setProjectName] = useState("");

  // Optional details accordion
  const [isShowingProjectDetails, setIsShowingProjectDetails] = useState(false);

  // Customer (Version B)
  const token = useMemo(() => localStorage.getItem("jwt"), []);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [newCustomerType, setNewCustomerType] = useState("homeowner");
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [customerError, setCustomerError] = useState("");

  // Billing optional
  const [billingName, setBillingName] = useState("");
  const [billingStreetName, setBillingStreetName] = useState("");
  const [billingCityName, setBillingCityName] = useState("");
  const [billingStateName, setBillingStateName] = useState("");
  const [billingZipCode, setBillingZipCode] = useState("");
  const [billingPrimaryPhone, setBillingPrimaryPhone] = useState("");
  const [billingSecondrayPhone, setBillingSecondaryPhone] = useState("");
  const [billingEmail, setBillingEmail] = useState("");

  // Jobsite required address
  const [siteName, setSiteName] = useState("");
  const [siteStreetName, setSiteStreetName] = useState("");
  const [siteCityName, setSiteCityName] = useState("");
  const [siteStateName, setSiteStateName] = useState("");
  const [siteZipCode, setSiteZipCode] = useState("");
  const [sitePrimaryPhone, setSitePrimaryPhone] = useState("");
  const [siteSecondaryPhone, setSiteSecondaryPhone] = useState("");
  const [siteEmail, setSiteEmail] = useState("");

  const navigate = useNavigate();

  function selectedCustomerDisplay(c) {
    if (!c) return "";
    return c.companyName ? `${c.companyName} — ${c.name}` : c.name;
  }

  function toggleProjectDetails() {
    setIsShowingProjectDetails((v) => !v);
  }

  function resetInputs() {
    setProjectName("");

    setCustomerQuery("");
    setCustomerResults([]);
    setSelectedCustomer(null);
    setNewCustomerType("homeowner");
    setIsCreatingCustomer(false);
    setCustomerError("");

    setBillingName("");
    setBillingStreetName("");
    setBillingCityName("");
    setBillingStateName("");
    setBillingZipCode("");
    setBillingPrimaryPhone("");
    setBillingSecondaryPhone("");
    setBillingEmail("");

    setSiteName("");
    setSiteStreetName("");
    setSiteCityName("");
    setSiteStateName("");
    setSiteZipCode("");
    setSitePrimaryPhone("");
    setSiteSecondaryPhone("");
    setSiteEmail("");

    setIsShowingProjectDetails(false);
  }

  function handleCloseModal() {
    resetInputs();
    closeModal();
  }

  async function handleQuickCreateCustomer() {
    try {
      setCustomerError("");
      const name = String(customerQuery || "").trim();
      if (!name) {
        setCustomerError("Customer name is required.");
        return;
      }
      if (!token) {
        setCustomerError("Missing auth token. Please re-login.");
        return;
      }

      setIsCreatingCustomer(true);
      const res = await createCustomer(token, {
        type: newCustomerType,
        name,
      });

      const created = res?.customer;
      if (!created?._id) {
        setCustomerError("Could not create customer.");
        return;
      }

      setSelectedCustomer(created);
      setCustomerQuery(selectedCustomerDisplay(created));
      setCustomerResults([]);

      // Convenience defaults (optional fields; user can change)
      setBillingName(created.name || "");
      setSiteName(created.name || "");
    } catch (err) {
      setCustomerError(err?.message || "Failed to create customer");
    } finally {
      setIsCreatingCustomer(false);
    }
  }

  // Typeahead search (debounced)
  useEffect(() => {
    if (!isOpen) return;
    if (!token) return;
    if (selectedCustomer) return;

    const q = String(customerQuery || "").trim();
    const t = setTimeout(async () => {
      try {
        if (!q) {
          setCustomerResults([]);
          return;
        }
        const res = await searchCustomers(token, q);
        setCustomerResults(Array.isArray(res?.customers) ? res.customers : []);
      } catch {
        setCustomerResults([]);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [customerQuery, token, isOpen, selectedCustomer]);

  function handleCreateProjectSubmit(e) {
    e.preventDefault();

    // Build address strings only if user typed them
    const billingAddress =
      billingStreetName || billingCityName || billingStateName || billingZipCode
        ? `${billingStreetName}, ${billingCityName}, ${billingStateName} ${billingZipCode}`.trim()
        : undefined;

    const siteAddress =
      `${siteStreetName}, ${siteCityName}, ${siteStateName} ${siteZipCode}`.trim();

    const projectData = {
      // Version B: projectName is optional now (server can auto-generate)
      projectName: projectName || undefined,
      customerId: selectedCustomer?._id,

      // Optional billing/contact (kept for backward compatibility)
      billingName: billingName || undefined,
      billingAddress,
      billingPrimaryPhone: billingPrimaryPhone || undefined,
      billingSecondrayPhone: billingSecondrayPhone || undefined,
      billingEmail: billingEmail || undefined,

      // Jobsite (address required)
      siteName: siteName || selectedCustomer?.name || undefined,
      siteAddress,
      sitePrimaryPhone: sitePrimaryPhone || undefined,
      siteSecondaryPhone: siteSecondaryPhone || undefined,
      siteEmail: siteEmail || undefined,
    };

    handleCloseModal();
    handleCreateProjectSubmitClick(projectData);
  }

  return (
    <div className={isOpen ? "modal modal_visible" : "modal"}>
      <form
        className="create-project-form"
        onSubmit={handleCreateProjectSubmit}
      >
        <header className="create-project-form__header">
          <h3 className="create-project-form__header-text">
            Create New Project
          </h3>
        </header>

        {/* FAST PATH: Customer + Jobsite address */}
        <div className="create-project-form__body">
          <label className="create-project-form__title" htmlFor="project-name">
            Project Name (optional)
            <input
              className="project-name__input"
              type="text"
              id="project-name"
              onChange={(e) => setProjectName(e.target.value)}
              value={projectName}
            />
          </label>
        </div>

        <div className="create-project-form__body">
          <label
            className="create-project-form__title"
            htmlFor="customer-picker"
          >
            Customer *
            <input
              className="project-name__input"
              type="text"
              id="customer-picker"
              placeholder="Search customers… or type a new name"
              onChange={(e) => {
                const v = e.target.value;
                setCustomerQuery(v);
                setCustomerError("");
                if (
                  selectedCustomer &&
                  v !== selectedCustomerDisplay(selectedCustomer)
                ) {
                  setSelectedCustomer(null);
                }
              }}
              value={customerQuery}
              required
            />
          </label>

          {customerResults.length > 0 && !selectedCustomer && (
            <div className="cp__suggestions">
              <div className="cp__suggestions-title">Suggestions</div>
              <div className="cp__suggestions-list">
                {customerResults.map((c) => (
                  <button
                    key={c._id}
                    type="button"
                    className="cp__suggestion"
                    onClick={() => {
                      setSelectedCustomer(c);
                      setCustomerQuery(selectedCustomerDisplay(c));
                      setCustomerResults([]);
                      setBillingName(c.name || "");
                      setSiteName(c.name || "");
                    }}
                  >
                    <div className="cp__suggestion-name">{c.name}</div>
                    <div className="cp__suggestion-sub">
                      {c.type
                        ? `${c.type.charAt(0).toUpperCase() + c.type.slice(1)}`
                        : ""}
                      {c.companyName ? ` • ${c.companyName}` : ""}
                      {c.phone ? ` • ${c.phone}` : ""}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!selectedCustomer && (
            <div className="cp__quickcreate">
              <select
                value={newCustomerType}
                onChange={(e) => setNewCustomerType(e.target.value)}
                className="cp__select"
              >
                <option value="homeowner">Homeowner</option>
                <option value="builder">Builder</option>
              </select>

              <button
                type="button"
                onClick={handleQuickCreateCustomer}
                disabled={isCreatingCustomer}
                className="cp__btn"
              >
                {isCreatingCustomer ? "Creating…" : "+ Create customer"}
              </button>
              <button
                type="button"
                className="cp__manageCustomersBtn"
                onClick={() => {
                  // keep existing flows safe: just navigate + close modal
                  closeModal();
                  navigate("/dashboard/customers");
                }}
              >
                Manage customers
              </button>

              {customerError && (
                <div className="cp__error">{customerError}</div>
              )}
            </div>
          )}

          {selectedCustomer && (
            <div className="cp__selected">
              Selected:{" "}
              <strong>{selectedCustomerDisplay(selectedCustomer)}</strong>
              <button
                type="button"
                className="cp__linkbtn"
                onClick={() => {
                  setSelectedCustomer(null);
                  setCustomerQuery("");
                  setCustomerResults([]);
                }}
              >
                Change
              </button>
            </div>
          )}
        </div>

        <div className="create-project-form__body">
          <h3 className="create-project-form__client-details create-project-form__bold-header">
            Jobsite Address *
          </h3>

          <label className="create-project-form__client-name create-project__label">
            Contact Name (optional)
            <input
              className="create-project-form__client-details-input_name create-project-form__input"
              type="text"
              placeholder="Ex: John Doe"
              onChange={(e) => setSiteName(e.target.value)}
              value={siteName}
            />
          </label>

          <label className="create-project-form__client-address create-project__label">
            Address *
            <input
              type="text"
              className="create-project-form__client-details-input_address-street create-project-form__input"
              placeholder="Street"
              onChange={(e) => setSiteStreetName(e.target.value)}
              value={siteStreetName}
              required
            />
            <div className="client-details__address-separator">
              <input
                type="text"
                className="create-project-form__client-details-input_address-city create-project-form__input"
                placeholder="City"
                onChange={(e) => setSiteCityName(e.target.value)}
                value={siteCityName}
                required
              />
            </div>
            <div className="client-details__address-separator client-details__bottom-margin">
              <input
                type="text"
                className="create-project-form__client-details-input_address-state create-project-form__input"
                placeholder="State"
                onChange={(e) => setSiteStateName(e.target.value)}
                value={siteStateName}
                required
              />
              <input
                type="text"
                className="create-project-form__client-details-input_address-zip create-project-form__input"
                placeholder="Zip Code"
                onChange={(e) => setSiteZipCode(e.target.value)}
                value={siteZipCode}
                required
              />
            </div>
          </label>

          <label className="create-project-form__client-phone create-project__label">
            Jobsite Phone (optional)
            <input
              type="phone"
              className="create-project-form__client-details-input_phone-primary create-project-form__input"
              placeholder="Phone Number"
              onChange={(e) => setSitePrimaryPhone(e.target.value)}
              value={sitePrimaryPhone}
            />
            Alternate Phone (optional)
            <input
              type="phone"
              className="create-project-form__client-details-input_phone-alternate create-project-form__input"
              placeholder="Alternate Number"
              onChange={(e) => setSiteSecondaryPhone(e.target.value)}
              value={siteSecondaryPhone}
            />
          </label>

          <label className="create-project-form__client-email create-project__label">
            Jobsite Email (optional)
            <input
              type="email"
              className="create-project-form__client-details-input_email create-project-form__input"
              placeholder="Email Address"
              onChange={(e) => setSiteEmail(e.target.value)}
              value={siteEmail}
            />
          </label>
        </div>

        {/* Optional details */}
        <p className="create-project-form__project-info">
          Optional details{" "}
          <img
            onClick={toggleProjectDetails}
            src={dropdown}
            alt="drop down arrow"
            className={
              !isShowingProjectDetails
                ? `create-project-form__drop-down-icon`
                : `create-project-form__drop-down-icon_flipped`
            }
          />
        </p>

        <div
          className={
            isShowingProjectDetails
              ? `create-project-form__body_extended create-project-form__body`
              : `create-project-form__body_not-extended create-project-form__body`
          }
        >
          <h3 className="create-project-form__client-details">
            Billing Information (optional)
          </h3>

          <label className="create-project-form__client-name create-project__label">
            Customer / Company Name
            <input
              className="create-project-form__client-details-input_name create-project-form__input"
              type="text"
              placeholder="Ex: ABC Roofing or John Doe"
              onChange={(e) => setBillingName(e.target.value)}
              value={billingName}
            />
          </label>

          <label className="create-project-form__client-address create-project__label">
            Billing Address
            <input
              type="text"
              className="create-project-form__client-details-input_address-street create-project-form__input"
              placeholder="Street"
              onChange={(e) => setBillingStreetName(e.target.value)}
              value={billingStreetName}
            />
            <div className="client-details__address-separator">
              <input
                type="text"
                className="create-project-form__client-details-input_address-city create-project-form__input"
                placeholder="City"
                onChange={(e) => setBillingCityName(e.target.value)}
                value={billingCityName}
              />
            </div>
            <div className="client-details__address-separator client-details__bottom-margin">
              <input
                type="text"
                className="create-project-form__client-details-input_address-state create-project-form__input"
                placeholder="State"
                onChange={(e) => setBillingStateName(e.target.value)}
                value={billingStateName}
              />
              <input
                type="text"
                className="create-project-form__client-details-input_address-zip create-project-form__input"
                placeholder="Zip Code"
                onChange={(e) => setBillingZipCode(e.target.value)}
                value={billingZipCode}
              />
            </div>
          </label>

          <label className="create-project-form__client-phone create-project__label">
            Billing Phone
            <input
              type="phone"
              className="create-project-form__client-details-input_phone-primary create-project-form__input"
              placeholder="Phone Number"
              onChange={(e) => setBillingPrimaryPhone(e.target.value)}
              value={billingPrimaryPhone}
            />
            Alternate Phone
            <input
              type="phone"
              className="create-project-form__client-details-input_phone-alternate create-project-form__input"
              placeholder="Alternate Number"
              onChange={(e) => setBillingSecondaryPhone(e.target.value)}
              value={billingSecondrayPhone}
            />
          </label>

          <label className="create-project-form__client-email create-project__label">
            Billing Email
            <input
              type="email"
              className="create-project-form__client-details-input_email create-project-form__input"
              placeholder="Email Address"
              onChange={(e) => setBillingEmail(e.target.value)}
              value={billingEmail}
            />
          </label>
        </div>

        <div className="create-project-form__footer">
          <button
            onClick={handleCloseModal}
            type="button"
            className="create-project-form__button_cancel"
          >
            Cancel
          </button>
          <button type="submit" className="create-project-form__button_create">
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
