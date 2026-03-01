// src/components/Photos/Project.jsx
import "./Project.css";
import { useParams } from "react-router-dom";
import backIcon from "../../assets/icons/back.svg";
import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import SavedEstimatesPanel from "../Estimates/SavedEstimatesPanel";
import FullscreenPhotoAnnotatorModal from "./FullscreenPhotoAnnotatorModal";
import PhotoThumbWithAnnotations from "../Photos/PhotoThumbWithAnnotations";

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
      .replace(",", "");
  };

  async function fetchPhotoAnnotations(projectId, photoId, token) {
    const res = await fetch(
      `${import.meta.env.VITE_API_URL}dashboard/projects/${projectId}/photos/${photoId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json?.photo?.annotations || null;
  }

  // local-only temp id generator for optimistic uploads
  function makeTempId() {
    try {
      return `temp_${crypto.randomUUID()}`;
    } catch {
      return `temp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    }
  }

  const [annotatorOpen, setAnnotatorOpen] = useState(false);
  const [annotatorPhotoId, setAnnotatorPhotoId] = useState(null);
  const [photoAnnotationsById, setPhotoAnnotationsById] = useState({});

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

  // track which photos are "optimistic local temps"
  const optimisticTempIdsRef = useRef(new Set());

  let project = projects.filter((item) => item._id === projectId)[0];

  useEffect(() => {
    const token = localStorage.getItem("jwt");
    retrieveProjectDiagrams(projectId, token).then((diagrams) => {
      setDiagramData(diagrams);
    });
  }, [diagrams]);

  useEffect(() => {
    setCurrentProjectId(projectId);
  }, [activeModal]);

  /**
   * Refresh photos from API (NO reload).
   * - preserves existing object URLs when possible to avoid flicker
   * - fetches missing thumbs as needed
   * - fetches annotations for photos we don't already have
   */
  async function refreshPhotosFromApi(projectIdArg) {
    if (!projectIdArg) return;

    let cancelled = false;
    setIsLoadingPhotos(true);

    try {
      const token = localStorage.getItem("jwt");
      const res = await getProjectPhotos(projectIdArg, token);
      const serverPhotos = res?.photos || [];

      // 1) update photo list
      setProjectPhotos(serverPhotos);

      // 2) update annotations map for any photo we haven't loaded yet
      setPhotoAnnotationsById((prev) => {
        // keep what we have; we will fill missing below async, then set again
        return prev || {};
      });

      const annotationsMapUpdates = {};
      await Promise.all(
        serverPhotos.map(async (p) => {
          const photoId = p?.id || p?._id || p?.photoId;
          if (!photoId) return;
          // if we already have annotations (or know it's empty), skip
          // NOTE: if you want to force refresh all annotations, remove this guard
          if (photoAnnotationsById?.[photoId]) return;

          const ann = await fetchPhotoAnnotations(projectIdArg, photoId, token);
          if (ann?.items?.length) annotationsMapUpdates[photoId] = ann;
        }),
      );

      if (!cancelled && Object.keys(annotationsMapUpdates).length) {
        setPhotoAnnotationsById((prev) => ({
          ...(prev || {}),
          ...annotationsMapUpdates,
        }));
      }

      // 3) thumbnails: preserve existing urls when possible, fetch missing
      setPhotoThumbUrlById((prev) => {
        const prevMap = prev || {};
        const nextMap = {};

        const serverIds = new Set();
        for (const p of serverPhotos) {
          const pid = p?.id || p?._id || p?.photoId;
          if (!pid) continue;
          serverIds.add(pid);
          if (prevMap[pid]) nextMap[pid] = prevMap[pid];
        }

        // revoke urls for ids no longer present AND any optimistic temp ids
        Object.entries(prevMap).forEach(([id, url]) => {
          const isTemp = optimisticTempIdsRef.current.has(id);
          const stillOnServer = serverIds.has(id);
          if (!stillOnServer || isTemp) {
            try {
              URL.revokeObjectURL(url);
            } catch {}
          }
        });

        return nextMap;
      });

      // fetch missing thumbs (async) and add them
      for (const p of serverPhotos) {
        const pid = p?.id || p?._id || p?.photoId;
        if (!pid) continue;

        // already have thumb
        if (photoThumbUrlById?.[pid]) continue;

        try {
          const blob = await fetchProjectPhotoBlob(
            projectIdArg,
            pid,
            token,
            "preview",
          );
          const url = URL.createObjectURL(blob);

          if (!cancelled) {
            setPhotoThumbUrlById((prev) => {
              // if we already got set, don’t replace
              if (prev?.[pid]) {
                try {
                  URL.revokeObjectURL(url);
                } catch {}
                return prev;
              }
              return { ...(prev || {}), [pid]: url };
            });
          } else {
            try {
              URL.revokeObjectURL(url);
            } catch {}
          }
        } catch {
          // fail soft
        }
      }

      // after a successful server refresh, clear temp ids tracking
      optimisticTempIdsRef.current.clear();
    } finally {
      if (!cancelled) setIsLoadingPhotos(false);
    }

    return () => {
      cancelled = true;
    };
  }

  useEffect(() => {
    if (!project?._id) return;

    let cancelled = false;

    async function loadInitialPhotos() {
      try {
        setIsLoadingPhotos(true);
        const token = localStorage.getItem("jwt");

        const res = await getProjectPhotos(project._id, token);
        const photos = res?.photos || [];

        const annotationsMap = {};

        await Promise.all(
          photos.map(async (p) => {
            const photoId = p?.id || p?._id || p?.photoId;
            if (!photoId) return;
            const ann = await fetchPhotoAnnotations(projectId, photoId, token);
            if (ann?.items?.length) {
              annotationsMap[photoId] = ann;
            }
          }),
        );

        if (cancelled) return;
        setPhotoAnnotationsById(annotationsMap);
        setProjectPhotos(photos);

        // Build object URLs for thumbnails (because <img src> cannot send Authorization)
        const newMap = {};
        for (const p of photos) {
          const photoId = p?.id || p?._id || p?.photoId;
          if (!photoId) continue;

          try {
            const blob = await fetchProjectPhotoBlob(
              project._id,
              photoId,
              token,
              "preview",
            );
            newMap[photoId] = URL.createObjectURL(blob);
          } catch {
            // fail soft
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

    loadInitialPhotos();

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

    const updatedLocal = { ...selectedDiagram, includedPhotoIds: next };
    setSelectedDiagram(updatedLocal);

    setDiagrams((prev) =>
      (prev || []).map((d) => (d._id === updatedLocal._id ? updatedLocal : d)),
    );

    try {
      const token = localStorage.getItem("jwt");
      await updateDiagram(project._id, selectedDiagram._id, token, {
        ...selectedDiagram,
        includedPhotoIds: next,
      });
    } catch (e) {
      console.warn("Failed to persist includedPhotoIds:", e);
    }
  }

  // Optimistically add selected files as thumbnails immediately
  function addOptimisticUploads(files) {
    const tempPhotos = files.map((f) => {
      const tempId = makeTempId();
      optimisticTempIdsRef.current.add(tempId);

      return {
        id: tempId,
        _id: tempId,
        originalMeta: { filename: f?.name || "upload" },
        __optimistic: true,
      };
    });

    // create object URLs immediately
    const tempThumbs = {};
    files.forEach((f, idx) => {
      const tempId = tempPhotos[idx]?._id;
      if (!tempId) return;
      try {
        tempThumbs[tempId] = URL.createObjectURL(f);
      } catch {}
    });

    // prepend to list so user sees them instantly
    setProjectPhotos((prev) => [...tempPhotos, ...(prev || [])]);
    setPhotoThumbUrlById((prev) => ({ ...(prev || {}), ...tempThumbs }));
  }

  async function deletePhotoOptimistic(photoId) {
    if (!photoId) return;

    // remove from UI immediately
    setProjectPhotos((prev) =>
      (prev || []).filter((p) => {
        const pid = p?._id || p?.id || p?.photoId;
        return pid !== photoId;
      }),
    );

    // if this photo was included in selected diagram, remove it immediately
    if (selectedDiagram?._id) {
      const cur = Array.isArray(selectedDiagram.includedPhotoIds)
        ? selectedDiagram.includedPhotoIds
        : [];
      if (cur.includes(photoId)) {
        const next = cur.filter((id) => id !== photoId);
        const updatedLocal = { ...selectedDiagram, includedPhotoIds: next };
        setSelectedDiagram(updatedLocal);
        setDiagrams((prev) =>
          (prev || []).map((d) =>
            d._id === updatedLocal._id ? updatedLocal : d,
          ),
        );
      }
    }

    // remove thumb url immediately
    setPhotoThumbUrlById((prev) => {
      const next = { ...(prev || {}) };
      const url = next[photoId];
      delete next[photoId];
      if (url) {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      }
      return next;
    });

    // remove annotations overlay immediately
    setPhotoAnnotationsById((prev) => {
      const next = { ...(prev || {}) };
      delete next[photoId];
      return next;
    });

    // then call API
    try {
      const token = localStorage.getItem("jwt");
      await deleteProjectPhoto(project._id, photoId, token);
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to delete photo");

      // safest recovery: re-sync from server (still no page reload)
      await refreshPhotosFromApi(project._id);
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

                    const files = picked.slice(0, 10);

                    // ✅ show thumbnails immediately (optimistic)
                    addOptimisticUploads(files);

                    try {
                      const token = localStorage.getItem("jwt");

                      if (files.length === 1) {
                        await uploadProjectPhoto(project._id, token, files[0]);
                      } else {
                        const res = await uploadProjectPhotosBulk(
                          project._id,
                          token,
                          files,
                        );

                        const failed = (res?.results || []).filter(
                          (r) => !r.ok,
                        );
                        if (failed.length) {
                          alert(
                            `Uploaded ${files.length - failed.length}/${files.length} photos.\n\nFailed:\n` +
                              failed
                                .map(
                                  (f) =>
                                    `- ${f.filename}: ${f.error || "failed"}`,
                                )
                                .join("\n"),
                          );
                        }
                      }

                      // reset input so re-selecting same files works
                      e.target.value = "";

                      // ✅ reconcile with server list (NO reload)
                      await refreshPhotosFromApi(project._id);
                    } catch (err) {
                      console.error(err);
                      alert(err?.message || "Upload failed");
                      e.target.value = "";

                      // safest recovery: re-sync from server (still no page reload)
                      await refreshPhotosFromApi(project._id);
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
                      ).includes(photoId);
                      const thumbSrc = photoThumbUrlById[photoId];

                      return (
                        <label
                          key={photoId}
                          style={{
                            width: 120,
                            border: checked
                              ? "2px solid #2a7"
                              : "1px solid #444",
                            padding: 6,
                            borderRadius: 6,
                            cursor: "pointer",
                            opacity: p?.__optimistic ? 0.75 : 1,
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
                              onChange={() => toggleIncludePhoto(photoId)}
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
                                  "Delete this photo?\n\nThis cannot be undone.",
                                );
                                if (!ok) return;

                                await deletePhotoOptimistic(photoId);
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
                              openAnnotator(photoId);
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
                              <PhotoThumbWithAnnotations
                                src={thumbSrc}
                                alt={p.originalMeta?.filename || "photo"}
                                annotations={photoAnnotationsById?.[photoId]}
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
              diagramData.map((diagram) => {
                // Prefer SVG (reliable across mobile/desktop). Fallback to raster thumbnail for legacy diagrams.
                const previewUrl = diagram?.svg
                  ? `data:image/svg+xml;utf8,${encodeURIComponent(diagram.svg)}`
                  : diagram?.imageData;

                return (
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
                        backgroundImage: previewUrl
                          ? `url(${previewUrl})`
                          : "none",
                        backgroundSize: "contain", // <— IMPORTANT: don’t crop/clip the drawing
                        backgroundPosition: "center",
                        backgroundRepeat: "no-repeat",
                        borderRadius: "5px",
                        backgroundColor: "#111", // makes “empty” obvious, still matches your dark UI vibe
                      }}
                    />
                    <p className="diagram__details">
                      {formatDateTime(diagram.createdAt)}
                    </p>
                  </div>
                );
              })
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
          // keep existing for backward-compat
          name: project?.projectName || project?.name || "",
          address: project?.siteAddress || project?.address || "",
          id: projectId || "",

          // Billing (Bill To)
          billingName: project?.billingName || "",
          billingAddress: project?.billingAddress || "",
          billingEmail: project?.billingEmail || "",
          billingPrimaryPhone: project?.billingPrimaryPhone || "",

          // Jobsite (Job Site)
          siteName: project?.siteName || "",
          siteAddress: project?.siteAddress || project?.address || "",
          siteEmail: project?.siteEmail || "",
          sitePrimaryPhone: project?.sitePrimaryPhone || "",
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
        onSaved={async (mergedServerItems) => {
          // ✅ instant overlay update in thumbnails
          if (annotatorPhotoId) {
            setPhotoAnnotationsById((prev) => ({
              ...(prev || {}),
              [annotatorPhotoId]: { items: mergedServerItems },
            }));

            // ✅ refresh ONLY this photo thumb preview blob so previews match ASAP
            try {
              const token = localStorage.getItem("jwt");
              const blob = await fetchProjectPhotoBlob(
                project._id,
                annotatorPhotoId,
                token,
                "preview",
              );
              const url = URL.createObjectURL(blob);

              setPhotoThumbUrlById((prev) => {
                const next = { ...(prev || {}) };
                const old = next[annotatorPhotoId];
                next[annotatorPhotoId] = url;
                if (old) {
                  try {
                    URL.revokeObjectURL(old);
                  } catch {}
                }
                return next;
              });
            } catch {
              // fail soft
            }
          }
        }}
      />
    </>
  );
}
