import './Projects.css'
import search from '../../assets/icons/search-icon.svg'
import ProjectRowData from '../ProjectRowData/ProjectRowData'
import CurrentUserContext from '../../contexts/CurrentUserContext/CurrentUserContext'
import CreateProjectModal from '../CreateProjectModal/CreateProjectModal'
import { useContext, useEffect } from 'react'
import {getProjects} from '../../utils/auth'

export default function Projects({closeModal, activeModal, setActiveModal, handleCreateProjectSubmit, projects, setProjects}){

  const currentUser = useContext(CurrentUserContext).currentUser;
  useEffect(()=>{
    const token = localStorage.getItem('jwt')
    getProjects(token).then(data => {
      const reverseOrderArray = data.projects.reverse()
      setProjects(reverseOrderArray)
    })
  }, [])


  function getDate(){
    const date = new Date
    const currentDate = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
    return currentDate
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
          {projects.length === 0 ? <tr className='project__table-body_no-projects'><td>You don&apos;t have any projects.</td></tr> : projects.map((project) => {
            return (<ProjectRowData key={project._id} project={project} owner={`${project.createdBy}`} created={project.createdAt}/>)
          })}
          

        </tbody>
      </table>
      <CreateProjectModal isOpen={activeModal === 'create-project'} closeModal={closeModal} handleCreateProjectSubmitClick={handleCreateProjectSubmit}/>
    </div>
  )
}