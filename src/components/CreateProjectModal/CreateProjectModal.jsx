import { useState, useEffect } from "react";
import "./CreateProjectModal.css";
import dropdown from "../../assets/icons/drop-down.svg";

export default function CreateProjectModal({
  isOpen,
  closeModal,
  handleCreateProjectSubmitClick,
}) {
  const [projectName, setProjectName] = useState("");
  const [isShowingProjectDetails, setIsShowingProjectDetails] = useState(false);
  const [billingName, setBillingName] = useState("");
  const [billingStreetName, setBillingStreetName] = useState("");
  const [billingCityName, setBillingCityName] = useState("");
  const [billingStateName, setBillingStateName] = useState("");
  const [billingZipCode, setBillingZipCode] = useState("");
  const [billingPrimaryPhone, setBillingPrimaryPhone] = useState("");
  const [billingSecondrayPhone, setBillingSecondaryPhone] = useState("");
  const [billingEmail, setBillingEmail] = useState("");

  const [siteName, setSiteName] = useState("");
  const [siteStreetName, setSiteStreetName] = useState("");
  const [siteCityName, setSiteCityName] = useState("");
  const [siteStateName, setSiteStateName] = useState("");
  const [siteZipCode, setSiteZipCode] = useState("");
  const [sitePrimaryPhone, setSitePrimaryPhone] = useState("");
  const [siteSecondaryPhone, setSiteSecondaryPhone] = useState("");
  const [siteEmail, setSiteEmail] = useState("");

  const [siteSameAsBilling, setSiteSameAsBilling] = useState(false);

  function handleProjectNameChange(e) {
    setProjectName(e.target.value);
  }

  function handleCustomerNameChange(e) {
    setBillingName(e.target.value);
  }

  function handleStreetNameChange(e) {
    setBillingStreetName(e.target.value);
  }

  function handleCityNameChange(e) {
    setBillingCityName(e.target.value);
  }

  function handleStateNameChange(e) {
    setBillingStateName(e.target.value);
  }

  function handleZipCodeChange(e) {
    setBillingZipCode(e.target.value);
  }

  function handlePrimaryPhoneNumberChange(e) {
    setBillingPrimaryPhone(e.target.value);
  }

  function handleSecondaryPhoneNumberChange(e) {
    setBillingSecondaryPhone(e.target.value);
  }

  function handleEmailChange(e) {
    setBillingEmail(e.target.value);
  }

  //==============================================================//

  function handleSiteNameChange(e) {
    setSiteName(e.target.value);
  }

  function handleSiteStreetChange(e) {
    setSiteStreetName(e.target.value);
  }

  function handleSiteCityChange(e) {
    setSiteCityName(e.target.value);
  }

  function handleSiteStateChange(e) {
    setSiteStateName(e.target.value);
  }

  function handleSiteZipChange(e) {
    setSiteZipCode(e.target.value);
  }

  function handleSitePrimaryNumberChange(e) {
    setSitePrimaryPhone(e.target.value);
  }

  function handleSiteSecondaryNumberChange(e) {
    setSiteSecondaryPhone(e.target.value);
  }

  function handleSiteEmailChange(e) {
    setSiteEmail(e.target.value);
  }

  function handleToggleAddress(e) {
    setSiteSameAsBilling(e.target.checked);
  }

  function handleCreateProjectSubmit(e) {
    e.preventDefault();
    const projectData = {
      projectName,
      billingName,
      billingAddress: `${billingStreetName}, ${billingCityName}, ${billingStateName} ${billingZipCode}`,
      billingPrimaryPhone,
      billingSecondrayPhone,
      billingEmail,
      siteName: siteSameAsBilling ? billingName : siteName,
      siteAddress: siteSameAsBilling
        ? `${billingStreetName}, ${billingCityName}, ${billingStateName} ${billingZipCode}`
        : `${siteStreetName}, ${siteCityName}, ${siteStateName} ${siteZipCode}`,
      sitePrimaryPhone: siteSameAsBilling
        ? billingPrimaryPhone
        : sitePrimaryPhone,
      siteSecondaryPhone: siteSameAsBilling
        ? billingSecondrayPhone
        : siteSecondaryPhone,
      siteEmail: siteSameAsBilling ? undefined : siteEmail,
    };
    handleCloseModal(e);
    handleCreateProjectSubmitClick(projectData);
  }

  function handleCloseModal(e) {
    resetInputs();
    closeModal();
  }

  function toggleProjectDetails() {
    setIsShowingProjectDetails(!isShowingProjectDetails);
  }

  function resetInputs() {
    setProjectName("");
    setBillingName("");
    setBillingStreetName("");
    setBillingCityName("");
    setBillingStateName("");
    setBillingZipCode("");
    setBillingPrimaryPhone("");
    setBillingSecondaryPhone("");
    setBillingEmail("");
    setSiteEmail("");
    setSiteSecondaryPhone("");
    setSitePrimaryPhone("");
    setSiteName("");
    setSiteStreetName("");
    setSiteCityName("");
    setSiteStateName("");
    setSiteZipCode("");
    setSiteSameAsBilling(false);
  }

  useEffect(() => {
    toggleProjectDetails();
  }, []);

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
        <div className="create-project-form__body">
          <label className="create-project-form__title" htmlFor="project-name">
            Project Name *
            <input
              className="project-name__input"
              type="text"
              id="project-name"
              onChange={handleProjectNameChange}
              value={projectName}
              required={true}
            />
          </label>
        </div>
        <p className="create-project-form__project-info">
          Project Details{" "}
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
            Billing Information
          </h3>
          <label
            htmlFor="client-name"
            className="create-project-form__client-name create-project__label"
          >
            Customer / Company Name *
            <input
              className="create-project-form__client-details-input_name create-project-form__input"
              type="text"
              id="client-name"
              placeholder="Ex: ABC Roofing or John Doe"
              onChange={handleCustomerNameChange}
              value={billingName}
            />
          </label>
          <div>
            <label
              htmlFor="client-address-street"
              className="create-project-form__client-address create-project__label"
            >
              Address *
              <input
                type="text"
                id="client-address-street"
                className="create-project-form__client-details-input_address-street create-project-form__input"
                placeholder="Street"
                onChange={handleStreetNameChange}
                value={billingStreetName}
                required={true}
              />
              <div className="client-details__address-separator">
                <input
                  type="text"
                  id="client-address-city"
                  className="create-project-form__client-details-input_address-city create-project-form__input"
                  placeholder="City"
                  onChange={handleCityNameChange}
                  value={billingCityName}
                  required={true}
                />
              </div>
              <div className="client-details__address-separator client-details__bottom-margin">
                <input
                  type="text"
                  id="client-address-state"
                  className="create-project-form__client-details-input_address-state create-project-form__input"
                  placeholder="State"
                  onChange={handleStateNameChange}
                  value={billingStateName}
                  required={true}
                />
                <input
                  type="text"
                  id="client-address-zip"
                  className="create-project-form__client-details-input_address-zip create-project-form__input"
                  placeholder="Zip Code"
                  onChange={handleZipCodeChange}
                  value={billingZipCode}
                  required={true}
                />
              </div>
            </label>
            <label
              htmlFor="client-phone"
              className="create-project-form__client-phone create-project__label"
            >
              Phone *
              <input
                type="phone"
                className="create-project-form__client-details-input_phone-primary create-project-form__input"
                placeholder="Phone Number"
                onChange={handlePrimaryPhoneNumberChange}
                value={billingPrimaryPhone}
                required={true}
              />
              Alternate Phone
              <input
                type="phone"
                className="create-project-form__client-details-input_phone-alternate create-project-form__input"
                placeholder="Alternate Number"
                onChange={handleSecondaryPhoneNumberChange}
                value={billingSecondrayPhone}
              />
            </label>
            <label
              htmlFor="client-email"
              className="create-project-form__client-email create-project__label"
            >
              Email *
              <input
                type="email"
                className="create-project-form__client-details-input_email create-project-form__input"
                placeholder="Email Address"
                onChange={handleEmailChange}
                value={billingEmail}
                required={true}
              />
            </label>
          </div>
          <h3 className="create-project-form__client-details create-project-form__site-info-header create-project-form__bold-header">
            Jobsite Information{" "}
            <span style={{ fontSize: "14px", fontWeight: "400" }}>
              <input
                onChange={handleToggleAddress}
                type="checkbox"
                checked={siteSameAsBilling}
                style={{ marginRight: "5px", fontWeight: "400" }}
              />
              Same as billing?
            </span>
          </h3>
          <label
            htmlFor="client-name"
            className="create-project-form__client-name create-project__label"
          >
            Customer Name *
            <input
              className={
                siteSameAsBilling
                  ? "create-project-form__client-details-input_name create-project-form__input create-project-form__input_disabled"
                  : "create-project-form__client-details-input_name create-project-form__input"
              }
              type="text"
              id="client-name"
              placeholder="Ex: John Doe"
              onChange={handleSiteNameChange}
              value={siteSameAsBilling ? billingName : siteName}
              disabled={siteSameAsBilling}
              required={true}
            />
          </label>
          <div>
            <label
              htmlFor="client-address-street"
              className="create-project-form__client-address create-project__label"
            >
              Address *
              <input
                type="text"
                id="client-address-street"
                className={
                  siteSameAsBilling
                    ? "create-project-form__client-details-input_address-street create-project-form__input create-project-form__input_disabled"
                    : "create-project-form__client-details-input_address-street create-project-form__input"
                }
                placeholder="Street"
                onChange={handleSiteStreetChange}
                value={siteSameAsBilling ? billingStreetName : siteStreetName}
                disabled={siteSameAsBilling}
                required={true}
              />
              <div className="client-details__address-separator">
                <input
                  type="text"
                  id="client-address-city"
                  className={
                    siteSameAsBilling
                      ? "create-project-form__client-details-input_address-city create-project-form__input create-project-form__input_disabled"
                      : "create-project-form__client-details-input_address-city create-project-form__input"
                  }
                  placeholder="City"
                  onChange={handleSiteCityChange}
                  value={siteSameAsBilling ? billingCityName : siteCityName}
                  disabled={siteSameAsBilling}
                  required={true}
                />
              </div>
              <div className="client-details__address-separator client-details__bottom-margin">
                <input
                  type="text"
                  id="client-address-state"
                  className={
                    siteSameAsBilling
                      ? "create-project-form__client-details-input_address-state create-project-form__input create-project-form__input_disabled"
                      : "create-project-form__client-details-input_address-state create-project-form__input"
                  }
                  placeholder="State"
                  onChange={handleSiteStateChange}
                  value={siteSameAsBilling ? billingStateName : siteStateName}
                  disabled={siteSameAsBilling}
                  required={true}
                />
                <input
                  type="text"
                  id="client-address-zip"
                  className={
                    siteSameAsBilling
                      ? "create-project-form__client-details-input_address-zip create-project-form__input create-project-form__input_disabled"
                      : "create-project-form__client-details-input_address-zip create-project-form__input"
                  }
                  placeholder="Zip Code"
                  onChange={handleSiteZipChange}
                  value={siteSameAsBilling ? billingZipCode : siteZipCode}
                  disabled={siteSameAsBilling}
                  required={true}
                />
              </div>
            </label>
            <label
              htmlFor="client-phone"
              className="create-project-form__client-phone create-project__label"
            >
              Phone *
              <input
                type="phone"
                className={
                  siteSameAsBilling
                    ? "create-project-form__client-details-input_phone-primary create-project-form__input create-project-form__input_disabled"
                    : "create-project-form__client-details-input_phone-primary create-project-form__input"
                }
                placeholder="Phone Number"
                onChange={handleSitePrimaryNumberChange}
                value={
                  siteSameAsBilling ? billingPrimaryPhone : sitePrimaryPhone
                }
                disabled={siteSameAsBilling}
                required={true}
              />
              Alternate Phone
              <input
                type="phone"
                className={
                  siteSameAsBilling
                    ? "create-project-form__client-details-input_phone-alternate create-project-form__input create-project-form__input_disabled"
                    : "create-project-form__client-details-input_phone-alternate create-project-form__input"
                }
                placeholder="Alternate Number"
                onChange={handleSiteSecondaryNumberChange}
                value={
                  siteSameAsBilling ? billingSecondrayPhone : siteSecondaryPhone
                }
                disabled={siteSameAsBilling}
              />
            </label>
            <label
              htmlFor="client-email"
              className="create-project-form__client-email create-project__label"
            >
              Email *
              <input
                type="email"
                className={
                  siteSameAsBilling
                    ? "create-project-form__client-details-input_email create-project-form__input create-project-form__input_disabled"
                    : "create-project-form__client-details-input_email create-project-form__input"
                }
                placeholder="Email Address"
                onChange={handleSiteEmailChange}
                value={siteSameAsBilling ? billingEmail : siteEmail}
                disabled={siteSameAsBilling}
                required={true}
              />
            </label>
          </div>
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
