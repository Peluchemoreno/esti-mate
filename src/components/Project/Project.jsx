import "./Project.css";
import { useParams } from "react-router-dom";
import backIcon from "../../assets/icons/back.svg";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
// at top with other imports
import SavedEstimatesPanel from "../Estimates/SavedEstimatesPanel";
import FullscreenPhotoAnnotatorModal from "./FullscreenPhotoAnnotatorModal";

import {
  deleteDiagram,
  deleteProject,
  retrieveProjectDiagrams,
  getProjectPhotos,
  uploadProjectPhoto,
  fetchProjectPhotoBlob,
  uploadProjectPhotosBulk,
  updateDiagram,
  deleteProjectPhoto,
} from "../../utils/api";
import EstimateModal from "../EstimateModal/EstimateModal";
import { useProductsPricing } from "../../hooks/useProducts";
import { red } from "@mui/material/colors";

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

  const [annotatorOpen, setAnnotatorOpen] = useState(false);
  const [annotatorPhotoId, setAnnotatorPhotoId] = useState(null);

  function openAnnotator(photoId) {
    if (!photoId) return;
    setAnnotatorPhotoId(photoId);
    setAnnotatorOpen(true);
  }

  function closeAnnotator() {
    setAnnotatorOpen(false);
    setAnnotatorPhotoId(null);
  }

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
  const [projectPhotos, setProjectPhotos] = useState([]);
  const [photoThumbUrlById, setPhotoThumbUrlById] = useState({});
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);

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

  useEffect(() => {
    if (!project?._id) return;

    let cancelled = false;

    async function loadPhotos() {
      try {
        setIsLoadingPhotos(true);
        const token = localStorage.getItem("jwt");

        const res = await getProjectPhotos(project._id, token);
        const photos = res?.photos || [];

        if (cancelled) return;
        setProjectPhotos(photos);

        // Build object URLs for thumbnails (because <img src> cannot send Authorization)
        const newMap = {};
        for (const p of photos) {
          try {
            const blob = await fetchProjectPhotoBlob(
              project._id,
              p.id,
              token,
              "preview"
            );
            newMap[p.id] = URL.createObjectURL(blob);
          } catch (e) {
            // fail soft: skip thumb if it fails
          }
        }

        if (!cancelled) {
          // Clean up old object URLs
          setPhotoThumbUrlById((prev) => {
            Object.values(prev).forEach((u) => {
              try {
                URL.revokeObjectURL(u);
              } catch {}
            });
            return newMap;
          });
        }
      } finally {
        if (!cancelled) setIsLoadingPhotos(false);
      }
    }

    loadPhotos();

    return () => {
      cancelled = true;
    };
  }, [project?._id]);

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

  async function toggleIncludePhoto(photoId) {
    if (!selectedDiagram?._id) return;

    const current = Array.isArray(selectedDiagram.includedPhotoIds)
      ? selectedDiagram.includedPhotoIds
      : [];

    const next = current.includes(photoId)
      ? current.filter((id) => id !== photoId)
      : [...current, photoId];

    // Update local selected diagram immediately (fast UI)
    const updatedLocal = { ...selectedDiagram, includedPhotoIds: next };
    setSelectedDiagram(updatedLocal);

    // Also update diagrams list state so selection sticks visually
    setDiagrams((prev) =>
      (prev || []).map((d) => (d._id === updatedLocal._id ? updatedLocal : d))
    );

    // Persist to DB using existing updateDiagram endpoint
    // IMPORTANT: send full diagram payload to avoid accidentally overwriting fields
    try {
      const token = localStorage.getItem("jwt");
      await updateDiagram(project._id, selectedDiagram._id, token, {
        ...selectedDiagram,
        includedPhotoIds: next,
      });
    } catch (e) {
      // fail soft: keep UI state, you can re-save on Generate Estimate if needed
      console.warn("Failed to persist includedPhotoIds:", e);
    }
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
                      window.scrollTo(0, 0);
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
                onClick={() => {
                  openDiagramModal();
                  window.scrollTo(0, 0);
                }}
                className="project__body-create-diagram-button create-button"
              >
                Create Diagram
              </button>
            )}
            {selectedDiagram?._id ? (
              <div style={{ marginTop: "12px" }}>
                <h3 style={{ margin: "8px 0" }}>Photos for this diagram</h3>

                {/* upload */}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={async (e) => {
                    const picked = Array.from(e.target.files || []);
                    if (!picked.length) return;

                    // enforce max 10 client-side (server also enforces)
                    const files = picked.slice(0, 10);

                    try {
                      const token = localStorage.getItem("jwt");

                      if (files.length === 1) {
                        // keep your single-file path working
                        await uploadProjectPhoto(project._id, token, files[0]);
                      } else {
                        const res = await uploadProjectPhotosBulk(
                          project._id,
                          token,
                          files
                        );

                        // Minimal UX: show failures without breaking flow
                        const failed = (res?.results || []).filter(
                          (r) => !r.ok
                        );
                        if (failed.length) {
                          alert(
                            `Uploaded ${files.length - failed.length}/${
                              files.length
                            } photos.\n\nFailed:\n` +
                              failed
                                .map(
                                  (f) =>
                                    `- ${f.filename}: ${f.error || "failed"}`
                                )
                                .join("\n")
                          );
                        }
                      }

                      // reset input so re-selecting same files works
                      e.target.value = "";

                      // simplest: reload so your existing load logic refreshes
                      window.location.reload();
                    } catch (err) {
                      console.error(err);
                      alert(err?.message || "Upload failed");
                      e.target.value = "";
                    }
                  }}
                />

                {isLoadingPhotos ? (
                  <p>Loading photos...</p>
                ) : projectPhotos.length === 0 ? (
                  <p>No photos yet</p>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "10px",
                      marginTop: "10px",
                    }}
                  >
                    {projectPhotos.map((p) => {
                      const photoId = p?._id || p?.id || p?.photoId;

                      const checked = (
                        selectedDiagram.includedPhotoIds || []
                      ).includes(p.id);
                      const thumbSrc = photoThumbUrlById[p.id];

                      return (
                        <label
                          key={p.id}
                          style={{
                            width: 120,
                            border: checked
                              ? "2px solid #2a7"
                              : "1px solid #444",
                            padding: 6,
                            borderRadius: 6,
                            cursor: "pointer",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleIncludePhoto(p.id)}
                              style={{ marginBottom: 6 }}
                            />
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();

                                if (!photoId) {
                                  alert("Cannot delete photo: missing id");
                                  return;
                                }

                                const ok = window.confirm(
                                  "Delete this photo?\n\nThis cannot be undone."
                                );
                                if (!ok) return;

                                try {
                                  const token = localStorage.getItem("jwt");
                                  await deleteProjectPhoto(
                                    project._id,
                                    photoId,
                                    token
                                  );
                                  window.location.reload();
                                } catch (err) {
                                  console.error(err);
                                  alert(
                                    err?.message || "Failed to delete photo"
                                  );
                                }
                              }}
                              style={{
                                borderRadius: 999,
                                padding: "2px 4px",
                                backgroundColor: "red",
                                marginBottom: 5,
                                border: "1px solid white",
                                color: "white",
                                cursor: "pointer",
                              }}
                              aria-label="Delete photo"
                              title="Delete photo"
                            >
                              🗑
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openAnnotator(p.id);
                            }}
                            style={{
                              width: 108,
                              height: 80,
                              background: "#111",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              overflow: "hidden",
                              borderRadius: 4,
                              border: "1px solid rgba(255,255,255,0.15)",
                              padding: 0,
                              cursor: "pointer",
                            }}
                            aria-label="Open fullscreen annotator"
                            title="Open annotator"
                          >
                            {thumbSrc ? (
                              <img
                                src={thumbSrc}
                                alt={p.originalMeta?.filename || "photo"}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                }}
                              />
                            ) : (
                              <span style={{ fontSize: 12 }}>no preview</span>
                            )}
                          </button>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}
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
      <FullscreenPhotoAnnotatorModal
        isOpen={annotatorOpen}
        onClose={closeAnnotator}
        projectId={project?._id}
        photoId={annotatorPhotoId}
        token={localStorage.getItem("jwt")}
        onSaved={() => {
          // simplest + safest: reload to refresh thumbs + hasAnnotations flags
          window.location.reload();
        }}
      />
    </>
  );
}
