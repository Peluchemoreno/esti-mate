// src/components/EstimateModal/EstimateViewerModal.jsx
import Modal from "react-modal";
import { useEffect, useMemo, useState } from "react";
import { PDFViewer } from "@react-pdf/renderer";
import EstimatePDF from "../EstimatePDF/EstimatePDF";
import { BASE_URL } from "../../utils/constants";

Modal.setAppElement("#root");

const brand = {
  bg: "#000000",
  fg: "var(--white)",
  border: "var(--white)",
};

export default function EstimateViewerModal({
  isOpen,
  onClose,
  estimateId,
  fallbackEstimate, // optional preloaded doc (from list row)
  currentUser,
  selectedProject,
  products,
}) {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("jwt") : null;

  const [doc, setDoc] = useState(fallbackEstimate || null);
  const [logoUrl, setLogoUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  // fetch one estimate by id
  useEffect(() => {
    if (!isOpen) return;
    if (!estimateId || !token) {
      setDoc(fallbackEstimate || null);
      return;
    }

    setLoading(true);
    fetch(`${BASE_URL}api/estimates/${estimateId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => setDoc(data?.estimate || null))
      .catch((e) => {
        console.error("Failed to fetch estimate:", e);
        setDoc(fallbackEstimate || null);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, estimateId, token]);

  // company logo
  useEffect(() => {
    if (!isOpen || !token || !currentUser?._id) return;
    fetch(`${BASE_URL}users/${currentUser._id}/logo`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      })
      .then((base64Image) => setLogoUrl(base64Image))
      .catch((err) => console.error("Failed to fetch logo:", err));
  }, [isOpen, token, currentUser?._id]);

  const pdfProps = useMemo(() => {
    if (!doc) return null;
    const padded = String(doc.estimateNumber || 0).padStart(3, "0");
    const proj = doc.projectSnapshot || {};

    // Saved rows exactly as stored:
    const savedItems = (doc.items || []).map((it) => ({
      name: it.name,
      quantity: Number(it.quantity || 0),
      price: Number(it.price || 0),
    }));

    // Bill To snapshot for PDF (use what the server stored)
    const billToSnapshot = {
      name: proj.name || "",
      address: proj.address || "",
      email: proj.email || "",
      phone: proj.phone || "",
    };

    return {
      estimate: null,
      selectedDiagram: {
        imageData: doc?.diagram?.imageData || null,
        lines: Array.isArray(doc?.diagram?.lines) ? doc.diagram.lines : [],
      },
      activeModal: null,
      currentUser,
      logoUrl,
      estimateData: {
        estimateNumber: padded,
        estimateDate: doc.estimateDate || "",
        notes: doc.notes || "",
      },
      project: { name: proj.name, address: proj.address },
      projectExtra: selectedProject,
      products,
      items: savedItems, // ← saved rows (preferred by EstimatePDF)
      billToSnapshot, // ← snapshot for Bill To
      showPrices: true,
      extraItems: [],
    };
  }, [doc, logoUrl, currentUser, products, selectedProject]);

  const modalStyle = {
    overlay: { backgroundColor: "rgba(0,0,0,0.5)" },
    content: {
      width: "60%",
      height: "80%",
      margin: "auto",
      padding: 0,
      borderRadius: "10px",
      backgroundColor: brand.bg,
      border: `1px solid ${brand.border}`,
      color: brand.fg,
      display: "flex",
      flexDirection: "column",
    },
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="View Estimate"
      style={modalStyle}
    >
      <div
        style={{
          padding: "10px 16px",
          borderBottom: `1px solid ${brand.border}`,
          display: "flex",
          alignItems: "center",
        }}
      >
        <h3 style={{ margin: 0, fontWeight: 700 }}>View Estimate</h3>
        <button
          onClick={onClose}
          style={{
            marginLeft: "auto",
            background: "transparent",
            color: brand.fg,
            border: `1px solid ${brand.border}`,
            borderRadius: 6,
            padding: "6px 10px",
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        {loading && <div style={{ padding: 16, color: "#aaa" }}>Loading…</div>}
        {!loading && pdfProps && (
          <PDFViewer style={{ width: "100%", height: "100%" }}>
            <EstimatePDF selectedProject={selectedProject} {...pdfProps} />
          </PDFViewer>
        )}
        {!loading && !pdfProps && (
          <div style={{ padding: 16, color: "#aaa" }}>
            Estimate not available.
          </div>
        )}
      </div>
    </Modal>
  );
}
