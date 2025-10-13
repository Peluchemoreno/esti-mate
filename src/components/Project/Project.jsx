import "./Project.css";
import { useParams } from "react-router-dom";
import backIcon from "../../assets/icons/back.svg";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
// at top with other imports
import SavedEstimatesPanel from "../Estimates/SavedEstimatesPanel";

import {
  deleteDiagram,
  deleteProject,
  retrieveProjectDiagrams,
} from "../../utils/api";
import EstimateModal from "../EstimateModal/EstimateModal";
import { useProductsPricing } from "../../hooks/useProducts";

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
  selectedDiagram,
  setSelectedDiagram,
}) {
  const formatDateTime = (value, tz = "America/Chicago") => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d
      .toLocaleString("en-US", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      })
      .replace(",", ""); // "09/09/2025 21:07:23"
  };

  const { data: allProducts = [] } = useProductsPricing();
  const allUnfilteredProducts = allProducts;
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

  let project = projects.filter((item) => {
    return item._id === projectId;
  })[0];

  useEffect(() => {
    const token = localStorage.getItem("jwt");

    retrieveProjectDiagrams(projectId, token).then((diagrams) => {
      setDiagramData(diagrams);
    });
  }, [diagrams]);

  useEffect(() => {
    setCurrentProjectId(projectId);
  }, [activeModal]);

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
            <SavedEstimatesPanel
              projectId={project?._id}
              currentUser={currentUser}
              products={allUnfilteredProducts}
              project={project}
            />

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
              diagramData.map((diagram) => (
                <div className="project__drawing-container" key={diagram._id}>
                  <div
                    className={`${
                      diagram._id === selectedDiagram._id
                        ? "project__drawing_selected"
                        : "project__drawing"
                    }`}
                    onClick={() => handleSelectDiagram(diagram)}
                    style={{
                      width: "200px",
                      height: "200px",
                      backgroundImage: `url(${diagram.imageData})`,
                      backgroundSize: "200px",
                      backgroundPosition: "center",
                      backgroundRepeat: "no-repeat",
                      borderRadius: "5px",
                    }}
                  />
                  <p className="diagram__details">
                    {formatDateTime(diagram.createdAt)}
                  </p>
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
        project={{
          name: project?.projectName || project?.name || "",
          address: project?.siteAddress || project?.address || "",
          id: projectId || "",
          billingName: project?.billingName || "",
          billingAddress: project?.billingAddress || "",
          billingEmail: project?.billingEmail || "",
          billingPrimaryPhone: project?.billingPrimaryPhone || "",
        }}
        selectedDiagram={selectedDiagram}
        setSelectedDiagram={setSelectedDiagram}
        activeModal={activeModal}
        currentUser={currentUser}
        products={allUnfilteredProducts}
      />
    </>
  );
}
