import { cloneElement, useEffect, useState } from "react";
import "./CreateProjectModal.css";
import dropdown from "../../assets/icons/drop-down.svg";
import { useNavigate } from "react-router-dom";

export default function CreateProjectModal({
  isOpen,
  closeModal,
  handleCreateProjectSubmitClick
}) {
  const [projectName, setProjectName] = useState("");
  const [isShowingProjectDetails, setIsShowingProjectDetails] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [streetName, setStreetName] = useState("");
  const [cityName, setCityName] = useState("");
  const [countyName, setCountyName] = useState("");
  const [stateName, setStateName] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [primaryPhoneNumber, setPrimaryPhoneNumber] = useState("");
  const [secondaryPhoneNumber, setSecondaryPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [projectData, setProjectData] = useState({})
  const navigator = useNavigate();

  function handleProjectNameChange(e) {
    setProjectName(e.target.value);
  }

  function handleCustomerNameChange(e) {
    setCustomerName(e.target.value);
  }

  function handleStreetNameChange(e) {
    setStreetName(e.target.value);
  }

  function handleCityNameChange(e) {
    setCityName(e.target.value);
  }

  function handleCountyNameChange(e) {
    setCountyName(e.target.value);
  }

  function handleStateNameChange(e) {
    setStateName(e.target.value);
  }

  function handleZipCodeChange(e) {
    setZipCode(e.target.value);
  }

  function handlePrimaryPhoneNumberChange(e) {
    setPrimaryPhoneNumber(e.target.value);
  }

  function handleSecondaryPhoneNumberChange(e) {
    setSecondaryPhoneNumber(e.target.value);
  }

  function handleEmailChange(e) {
    setEmail(e.target.value);
  }

  function handleCreateProjectSubmit(e) {
    e.preventDefault();
    const projectData = {
      projectName,
      clientName: customerName,
      address: `${streetName} ${cityName}, ${countyName} ${stateName} ${zipCode}`,
      primaryPhoneNumber,
      secondaryPhoneNumber,
      email,
    };
    handleCloseModal(e)
    handleCreateProjectSubmitClick(projectData)
  }

  function handleCloseModal(e) {
    resetInputs(e)
    closeModal();
  }

  function toggleProjectDetails() {
    setIsShowingProjectDetails(!isShowingProjectDetails);
  }

  function resetInputs(e){
    setProjectName(e.target.value)
    setCustomerName(e.target.value)
    setStreetName(e.target.value)
    setCityName(e.target.value)
    setCountyName(e.target.value)
    setStateName(e.target.value)
    setZipCode(e.target.value)
    setPrimaryPhoneNumber(e.target.value)
    setSecondaryPhoneNumber(e.target.value)
    setEmail(e.target.value)
  }

  return (
    <div className={isOpen ? "modal modal_visible" : "modal"}>
      <form className="create-project-form">
        <header className="create-project-form__header">
          <h3 className="create-project-form__header-text">
            Create New Project
          </h3>
        </header>
        <div className="create-project-form__body">
          <label className="create-project-form__title" htmlFor="project-name">
            Project Name
            <input
              className="project-name__input"
              type="text"
              id="project-name"
              onChange={handleProjectNameChange}
              value={projectName}
            />
          </label>
        </div>
        <p className="create-project-form__project-info">
          Project Information{" "}
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
          <h4 className="create-project-form__client-details">
            Client Details
          </h4>
          <label
            htmlFor="client-name"
            className="create-project-form__client-name create-project__label"
          >
            Name
            <input
              className="create-project-form__client-details-input_name create-project-form__input"
              type="text"
              id="client-name"
              placeholder="Customer Name"
              onChange={handleCustomerNameChange}
              value={customerName}
            />
          </label>
          <div>
            <label
              htmlFor="client-address-street"
              className="create-project-form__client-address create-project__label"
            >
              Address
              <input
                type="text"
                id="client-address-street"
                className="create-project-form__client-details-input_address-street create-project-form__input"
                placeholder="Street"
                onChange={handleStreetNameChange}
                value={streetName}
              />
              <div className="client-details__address-separator">
                <input
                  type="text"
                  id="client-address-city"
                  className="create-project-form__client-details-input_address-city create-project-form__input"
                  placeholder="City"
                  onChange={handleCityNameChange}
                  value={cityName}
                />
                <input
                  type="text"
                  id="client-address-county"
                  className="create-project-form__client-details-input_address-county create-project-form__input"
                  placeholder="County"
                  onChange={handleCountyNameChange}
                  value={countyName}
                />
              </div>
              <div className="client-details__address-separator client-details__bottom-margin">
                <input
                  type="text"
                  id="client-address-state"
                  className="create-project-form__client-details-input_address-state create-project-form__input"
                  placeholder="State"
                  onChange={handleStateNameChange}
                  value={stateName}
                />
                <input
                  type="text"
                  id="client-address-zip"
                  className="create-project-form__client-details-input_address-zip create-project-form__input"
                  placeholder="Zip Code"
                  onChange={handleZipCodeChange}
                  value={zipCode}
                />
              </div>
            </label>
            <label
              htmlFor="client-phone"
              className="create-project-form__client-phone create-project__label"
            >
              Phone
              <input
                type="phone"
                className="create-project-form__client-details-input_phone-primary create-project-form__input"
                placeholder="Phone Number"
                onChange={handlePrimaryPhoneNumberChange}
                value={primaryPhoneNumber}
              />
              <input
                type="phone"
                className="create-project-form__client-details-input_phone-alternate create-project-form__input"
                placeholder="Alternate Number"
                onChange={handleSecondaryPhoneNumberChange}
                value={secondaryPhoneNumber}
              />
            </label>
            <label
              htmlFor="client-email"
              className="create-project-form__client-email create-project__label"
            >
              Email
              <input
                type="email"
                className="create-project-form__client-details-input_email create-project-form__input"
                placeholder="Email Address"
                onChange={handleEmailChange}
                value={email}
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
          <button
            onClick={handleCreateProjectSubmit}
            type="submit"
            className="create-project-form__button_create"
          >
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
