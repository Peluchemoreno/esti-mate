import { useEffect, useState } from "react";
import "./CreateProjectModal.css";
import dropdown from '../../assets/icons/drop-down.svg'

export default function CreateProjectModal({isOpen, closeModal, handleProjectSubmit}) {

  const [projectName, setProjectName] = useState('')
  const [isShowingProjectDetails, setIsShowingProjectDetails] = useState(false)


  function handleProjectNameChange(e){
    setProjectName(e.target.value)
  }

  function handleCreateProjectSubmit(e){
    e.preventDefault()
    handleProjectSubmit(projectName)
    setProjectName(e.target.value)
    closeModal()
  }

  function handleCloseModal(e){
    setProjectName(e.target.value)
    closeModal()
  }

  function toggleProjectDetails(){
    setIsShowingProjectDetails(!isShowingProjectDetails)
  }


  return (
    <div className={isOpen ? 'modal modal_visible' : 'modal'}>
      <form className="create-project-form">
        <header className="create-project-form__header">
          <h3 className="create-project-form__header-text">Create New Project</h3>
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
        <p className="create-project-form__project-info">Project Information <img onClick={toggleProjectDetails} src={dropdown} alt="drop down arrow" className={!isShowingProjectDetails ? `create-project-form__drop-down-icon` : `create-project-form__drop-down-icon_flipped`} /></p>
        <div className={isShowingProjectDetails ? `create-project-form__body_extended create-project-form__body` : `create-project-form__body_not-extended create-project-form__body`}>
          <h4 className="create-project-form__client-details">Client Details</h4>
          <label htmlFor="client-name" className="create-project-form__client-name create-project__label">Name
            <input className="create-project-form__client-details-input_name create-project-form__input" type="text" id="client-name" placeholder="Customer Name"/>
          </label>
          <div>
            <label htmlFor="client-address-street" className="create-project-form__client-address create-project__label">Address
              <input type='text' id="client-address-street" className="create-project-form__client-details-input_address-street create-project-form__input" placeholder="Street" />
              <div className="client-details__address-separator">
                <input type='text' id="client-address-city" className="create-project-form__client-details-input_address-city create-project-form__input" placeholder="City" />
                <input type='text' id="client-address-county" className="create-project-form__client-details-input_address-county create-project-form__input" placeholder="County" />
              </div>
              <div className="client-details__address-separator client-details__bottom-margin">
                <input type='text' id="client-address-state" className="create-project-form__client-details-input_address-state create-project-form__input" placeholder="State" />
                <input type='text' id="client-address-zip" className="create-project-form__client-details-input_address-zip create-project-form__input" placeholder="Zip Code" />
              </div>
            </label>
            <label htmlFor="client-phone" className="create-project-form__client-phone create-project__label">Phone
              <input type="phone" className="create-project-form__client-details-input_phone-primary create-project-form__input" placeholder="Phone Number" />
              <input type="phone" className="create-project-form__client-details-input_phone-alternate create-project-form__input" placeholder="Alternate Number" />
            </label>
            <label htmlFor="client-email" className="create-project-form__client-email create-project__label">Email
              <input type="email" className="create-project-form__client-details-input_email create-project-form__input" placeholder="Email Address" />
            </label>
          </div>
        </div>
        <div className="create-project-form__footer">
          <button onClick={handleCloseModal} type="button" className="create-project-form__button_cancel">Cancel</button>
          <button onClick={handleCreateProjectSubmit} type="submit" className="create-project-form__button_create">Create</button>
        </div>
      </form>
    </div>
  );
}
