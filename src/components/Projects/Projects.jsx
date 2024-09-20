import './Projects.css'
import search from '../../assets/icons/search-icon.svg'
import ProjectRowData from '../ProjectRowData/ProjectRowData'
import CurrentUserContext from '../../contexts/CurrentUserContext/CurrentUserContext'
import CreateProjectModal from '../CreateProjectModal/CreateProjectModal'
import { useContext, useEffect } from 'react'
import { useState } from 'react'

export default function Projects({closeModal, activeModal, setActiveModal}){

  const currentUser = useContext(CurrentUserContext).currentUser;
  const [projects, setProjects] = useState([])


  function getDate(){
    const date = new Date
    const currentDate = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
    return currentDate
  }



  function handleProjectSubmit(projectData){
    setProjects([...projects, projectData])
  }
  

  function openCreateProjectModal(){
    setActiveModal('create-project')
  }


  return (
    <div className='projects'>
      <header className="projects__header header">
        <button onClick={openCreateProjectModal} className="header__create-project-button">Create Project</button>
        <label htmlFor="search-projects" className='search-projects-label'>
          <input id='search-projects' type="text" className="header__search-projects" placeholder='Search Projects'/>
          <button className="header__search-projects-button"><img className='search-icon' src={search} alt="search button" /></button>
        </label>
      </header>
      <table className="project__table">
        <thead className='project__table-header'>
          <tr>
            <th className='project__table_project-name'>
              <label className="project__select-all-checkbox checkbox">
                <input type="checkbox" name="select-all" id="selectAll" />
              </label>
              <span>Project Name</span>
            </th>
            <th className='project__owner-column'>Owner</th>
            <th className='project__created-column'>Created</th>
          </tr>
        </thead>
        <tbody className="project__table-body">
          {projects.map((project, index) => {
            return (<ProjectRowData key={index} projectName={project} owner={`${currentUser?.firstName} ${currentUser?.lastName}`} created={(getDate())} />)
          })}

        </tbody>
      </table>
      <CreateProjectModal isOpen={activeModal === 'create-project'} closeModal={closeModal} handleProjectSubmit={handleProjectSubmit}/>
    </div>
  )
}