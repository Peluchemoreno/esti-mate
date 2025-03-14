import "./Project.css";
import { useParams } from "react-router-dom";
import backIcon from "../../assets/icons/back.svg";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { addDiagramToProject, deleteProject } from "../../utils/api";

export default function Project({
  projects,
  setActiveModal,
  setMobileDiagramActive,
  isMobile,
  setCurrentProjectId,
  activeModal,
  diagrams,
  setDiagrams,
}) {
  // console.log(setMobileDiagramActive)
  const params = useParams();
  const projectId = params.projectId;

  const [dummyState, setDummyState] = useState(0);

  // Function to force re-render
  function forceUpdate() {
    setDummyState(dummyState + 1);
  }

  let project = projects.filter((item) => {
    return item._id === projectId;
  })[0];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    setCurrentProjectId(projectId);
    forceUpdate();
  }, [activeModal]);

  // console.log(project)
  const navigator = useNavigate();

  function openDiagramModal() {
    if (isMobile) {
      setMobileDiagramActive(true);
    }
    setActiveModal("diagram");
  }

  function handleDeleteProject() {
    const token = localStorage.getItem("jwt");
    deleteProject(project._id, token).then(() => {
      navigator(-1);
    });
  }

  return (
    <>
      <div className="project">
        <div className="project__header">
          <p className="project__header-title">
            <img
              onClick={() => {
                navigator(-1);
              }}
              src={backIcon}
              alt="go back"
              className="project__back-icon"
            />
            {project?.projectName.toUpperCase()}
          </p>
          <button
            onClick={handleDeleteProject}
            className="project__delete-button"
          >
            Delete project
          </button>
        </div>
        <div className="project__body">
          <div className="project__body-create-estimate-section">
            <button className="project__body-create-estimate-button create-button">
              Generate Estimate
            </button>
            <div className="project__body-horizontal-spacer"></div>
            <h2 className="project__body-diagram-header">Diagram</h2>
            <button
              onClick={openDiagramModal}
              className="project__body-create-diagram-button create-button"
            >
              Create Diagram
            </button>
          </div>
          <div className="project__diagram-container">
            {project?.diagrams
              ? project.diagrams.map((diagram, index) => {
                  return (
                    <div
                      key={diagram._id}
                      className="project__drawing"
                      alt="Diagram image"
                      onClick={() => {
                        console.log(diagram);
                        console.log(diagram._id);
                      }}
                      style={{
                        width: "200px",
                        height: "200px",
                        backgroundImage: `url(${diagram.imageData})`, // Correct usage
                        backgroundSize: "500px 500px", // Ensure it's properly formatted
                        backgroundPosition: "50% 50%", // Center the zoomed-in portion
                        backgroundRepeat: "no-repeat",
                      }}
                    ></div>
                  );
                })
              : "No Diagrams"}
          </div>
        </div>
      </div>
    </>
  );
}
