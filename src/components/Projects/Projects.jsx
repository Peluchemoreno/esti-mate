import "./Projects.css";
import search from "../../assets/icons/search-icon.svg";
import ProjectRowData from "../ProjectRowData/ProjectRowData";
import CurrentUserContext from "../../contexts/CurrentUserContext/CurrentUserContext";
import CreateProjectModal from "../CreateProjectModal/CreateProjectModal";
import { useContext, useEffect, useState } from "react";
import { getProjects } from "../../utils/auth";

export default function Projects({
  closeModal,
  activeModal,
  setActiveModal,
  handleCreateProjectSubmit,
  projects,
  setProjects,
}) {
  const currentUser = useContext(CurrentUserContext);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("jwt");
    getProjects(token).then((data) => {
      if (data.length === 0) {
        setProjects([]);
      } else {
        const reverseOrderArray = data.projects.reverse();
        setProjects(reverseOrderArray);
      }
    });
  }, []);

  function openCreateProjectModal() {
    setActiveModal("create-project");
  }

  function handleSearchChange(e) {
    setSearchTerm(e.target.value);
  }

  const filteredProjects = projects.filter((project) =>
    project.projectName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="projects">
      <h3 className="projects__header-title">Projects</h3>
      <header className="projects__header header">
        <button
          onClick={openCreateProjectModal}
          className="header__create-project-button"
        >
          Create Project
        </button>
        <label htmlFor="search-projects" className="search-projects-label">
          <input
            id="search-projects"
            type="text"
            className="header__search-projects"
            placeholder="Search Projects"
            value={searchTerm}
            onChange={handleSearchChange}
          />
        </label>
      </header>
      <table className="project__table">
        <thead className="project__table-header">
          <tr>
            <th className="project__table_project-name">
              <label className="project__select-all-checkbox checkbox">
                <input type="checkbox" name="select-all" id="selectAll" />
              </label>
              <span>Project Name</span>
            </th>
            <th className="project__owner-column">Owner</th>
            <th className="project__created-column">Created</th>
          </tr>
        </thead>
        <tbody className="project__table-body">
          {projects.length === 0 ? (
            <tr className="project__table-body_no-projects">
              <td>You don&apos;t have any projects.</td>
            </tr>
          ) : (
            filteredProjects.map((project) => {
              return (
                <ProjectRowData
                  key={project._id}
                  project={project}
                  owner={`${project.userId}`}
                  created={project.createdAt.replace(/T.+/g, "")}
                />
              );
            })
          )}
        </tbody>
      </table>
      <CreateProjectModal
        isOpen={activeModal === "create-project"}
        closeModal={closeModal}
        handleCreateProjectSubmitClick={handleCreateProjectSubmit}
      />
    </div>
  );
}
