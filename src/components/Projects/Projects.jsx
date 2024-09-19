import './Projects.css'
import search from '../../assets/icons/search-icon.svg'
import ProjectRowData from '../ProjectRowData/ProjectRowData'

export default function Projects(){

  function getDate(){
    const date = new Date()
    const currentDate = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDay()}`
    return currentDate
  }

  return (
    <div className='projects'>
      <header className="projects__header header">
        <button className="header__create-project-button">Create Project</button>
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
            <th>Owner</th>
            <th className='project__created-column'>Created</th>
          </tr>
        </thead>
        <tbody className="project__table-body">
          <ProjectRowData projectName='Test Project 1' owner='Test Project Owner' created={getDate()}/>
          <ProjectRowData projectName='Test Project 2' owner='Test Project Owner' created={getDate()}/>
          <ProjectRowData projectName='Test Project 3' owner='Test Project Owner' created={getDate()}/>
          <ProjectRowData projectName='Test Project 4' owner='Test Project Owner' created={getDate()}/>
          <ProjectRowData projectName='Sheryl Margret' owner='Test Project Owner' created={getDate()}/>
        </tbody>
      </table>
    </div>
  )
}