import "./Project.css";
import { useParams } from "react-router-dom";
import backIcon from "../../assets/icons/back.svg";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  addDiagramToProject,
  deleteDiagram,
  deleteProject,
  retrieveProjectDiagrams,
} from "../../utils/api";
import { EstimatePDFButton, EstimatePDF } from "../EstimatePDF/EstimatePDF";
import EstimateModal from "../EstimateModal/EstimateModal";

export default function Project({
  projects,
  setActiveModal,
  setMobileDiagramActive,
  isMobile,
  setCurrentProjectId,
  activeModal,
  diagrams,
  handleEditDiagram,
  closeModal,
  setDiagrams,
  currentUser,
}) {
  // console.log(setMobileDiagramActive)
  const params = useParams();
  const projectId = params.projectId;
  const [testData, setTestData] = useState({
    customerName: "John Doe",
    address: "123 Main St, City, State",
    gutterType: "Aluminum",
    length: 50,
    totalCost: 500,
  });
  const [diagramData, setDiagramData] = useState([]);
  const [selectedDiagram, setSelectedDiagram] = useState({});

  let project = projects.filter((item) => {
    return item._id === projectId;
  })[0];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (activeModal === "") {
      setSelectedDiagram({});
    }
  }, [activeModal]);

  useEffect(() => {
    const token = localStorage.getItem("jwt");

    retrieveProjectDiagrams(projectId, token).then((diagrams) => {
      setDiagramData(diagrams);
    });
  }, [diagrams]);

  useEffect(() => {
    setCurrentProjectId(projectId);
  }, [activeModal]);

  useEffect(() => {
    console.log(diagramData)
    }, [diagramData]);

  // console.log(project)
  const navigator = useNavigate();

  function openDiagramModal() {
    if (isMobile) {
      setMobileDiagramActive(true);
    }
    setActiveModal("diagram");
  }

  function editDiagram(diagram) {
    setActiveModal("diagram");
    handleEditDiagram(diagram);
  }

  function handleDeleteProject() {
    const token = localStorage.getItem("jwt");
    deleteProject(project._id, token).then(() => {
      navigator(-1);
    });
  }

  function handleDeleteDiagram(diagram) {
    const token = localStorage.getItem("jwt");
    deleteDiagram(project._id, diagram._id, token).then((diagrams) => {
      setDiagrams(diagrams);
      setSelectedDiagram({});
    });
  }

  function handleSelectDiagram(diagram) {
    if (selectedDiagram._id) {
      if (selectedDiagram._id === diagram._id) {
        setSelectedDiagram({});
        return;
      }
    }
    setSelectedDiagram(diagram);
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
            <button
              onClick={() => {
                if (!selectedDiagram._id) {
                  alert("Please select a diagram first");
                  return;
                }
                setActiveModal("estimate-modal");
              }}
              className="project__body-create-estimate-button create-button"
            >
              Generate Estimate
            </button>

            <div className="project__body-horizontal-spacer"></div>
            <h2 className="project__body-diagram-header">Diagram</h2>
            {selectedDiagram._id ? (
              <>
                <div className="project__button-split">
                  <button
                    onClick={() => {
                      editDiagram(selectedDiagram);
                    }}
                    className="project__body-create-diagram-button create-button"
                  >
                    Edit Diagram
                  </button>
                  <button
                    onClick={() => {
                      handleDeleteDiagram(selectedDiagram);
                    }}
                    className="project__delete-diagram-button"
                  >
                    Delete Diagram
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={openDiagramModal}
                className="project__body-create-diagram-button create-button"
              >
                Create Diagram
              </button>
            )}
          </div>
          <div className="project__diagram-container">
            {diagramData.length > 0 ? (
              diagramData.map((diagram, index) => (
                <div
                  key={index}
                  className={`${
                    diagram._id === selectedDiagram._id
                      ? "project__drawing_selected"
                      : "project__drawing"
                  }`}
                  alt="Diagram image"
                  onClick={() => {
                    handleSelectDiagram(diagram);
                  }}
                  style={{
                    width: "200px",
                    height: "200px",
                    backgroundImage: `url(${diagram.imageData})`,
                    backgroundSize: "200px",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                    borderRadius: '5px',
                  }}
                >
                </div>
              ))
            ) : (
              <p>No Diagrams</p>
            )}
          </div>
        </div>
      </div>
      <EstimateModal
        isOpen={activeModal === "estimate-modal"}
        onClose={closeModal}
        estimate={testData}
        project={project}
        selectedDiagram={selectedDiagram}
        activeModal={activeModal}
        currentUser={currentUser}
      />
    </>
  );
}
