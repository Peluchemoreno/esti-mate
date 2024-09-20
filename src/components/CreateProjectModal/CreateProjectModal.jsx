import { useEffect, useState } from "react";
import "./CreateProjectModal.css";

export default function CreateProjectModal({isOpen, closeModal, handleProjectSubmit}) {

  const [projectName, setProjectName] = useState('')


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


  return (
    <div className={isOpen ? 'modal modal_visible' : 'modal'}>
      <form className="create-project-form">
        <header className="create-project-form__header">
          <h3 className="create-project-form__header-text">Create New Project</h3>
        </header>
        <div className="create-project-form__body">
          <label htmlFor="project-name">
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
        <div className="create-project-form__footer">
          <button onClick={handleCloseModal} type="button" className="create-project-form__button_cancel">Cancel</button>
          <button onClick={handleCreateProjectSubmit} type="submit" className="create-project-form__button_create">Create</button>
        </div>
      </form>
    </div>
  );
}
