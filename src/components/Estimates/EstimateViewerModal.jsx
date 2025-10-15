// src/components/Estimates/EstimateViewerModal.jsx
import Modal from "react-modal";
import { useEffect, useMemo, useState } from "react";
import { PDFViewer } from "@react-pdf/renderer";
import EstimatePDF from "../EstimatePDF/EstimatePDF";
const BASE_URL = import.meta.env.VITE_API_URL;
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
  selectedProject, // <-- live project (has billingName, etc.)
  products,
}) {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("jwt") : null;

  const [doc, setDoc] = useState(() => fallbackEstimate || null);
  const [logoUrl, setLogoUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  // fetch the estimate by id when opened
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

  // company logo as base64 (so @react-pdf can embed it)
  useEffect(() => {
    if (!isOpen || !token || !currentUser?._id) return;
    fetch(`${BASE_URL}users/${currentUser._id}/logo`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.blob() : Promise.reject(res)))
      .then(
        (blob) =>
          new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onloadend = () => resolve(r.result);
            r.onerror = reject;
            r.readAsDataURL(blob);
          })
      )
      .then((b64) => setLogoUrl(b64))
      .catch((err) => {
        console.warn("No logo or failed to load logo:", err);
        setLogoUrl(null);
      });
  }, [isOpen, token, currentUser?._id]);

  // Build the exact props EstimatePDF expects, preferring selectedProject over snapshot
  const pdfProps = useMemo(() => {
    if (!doc) return null;

    const snap = doc.projectSnapshot || {};
    const proj = selectedProject || {};

    // Number padded like preview
    const paddedNum = String(doc.estimateNumber || 0).padStart(3, "0");

    // BILL TO — EXACT fields from live project first, then snapshot
    const billingName = proj.billingName ?? snap.billingName ?? "";
    const billingAddress = proj.billingAddress ?? snap.billingAddress ?? "";
    const billingPrimaryPhone =
      proj.billingPrimaryPhone ?? snap.billingPrimaryPhone ?? "";

    // JOB SITE — EXACT fields from live project first, then snapshot
    const projectName = proj.projectName ?? snap.projectName ?? proj.name ?? "";
    const projectAddress =
      proj.projectAddress ?? snap.projectAddress ?? proj.address ?? "";

    return {
      // Diagram / lines (prefer saved doc)
      selectedDiagram: {
        imageData: doc?.diagram?.imageData || null,
        lines: Array.isArray(doc?.diagram?.lines) ? doc.diagram.lines : [],
        accessories: doc?.accessories || undefined,
      },

      // Identity / header info
      currentUser,
      logoUrl,
      estimateData: {
        estimateNumber: paddedNum,
        estimateDate: doc.estimateDate || "",
        paymentDue: doc.paymentDue || "Upon completion.", // ensure default with period
        notes: doc.notes || "",
      },

      // PROJECT passed exactly as preview expects
      project: {
        billingName,
        billingAddress,
        billingPrimaryPhone,
        projectName,
        projectAddress,
        // keep legacy fields too in case EstimatePDF reads name/address:
        name: projectName,
        address: projectAddress,
      },

      // Items saved with estimate (incl. impromptu)
      items: (doc.items || []).map((it) => ({
        name: it.name,
        quantity: Number(it.quantity || 0),
        price: Number(it.price || 0),
      })),

      // Pass-throughs
      products,
      showPrices: doc.showPrices ?? true,
      estimate: doc, // let PDF fall back to snapshot if ever needed
      extraItems: [], // not used for saved docs
    };
  }, [doc, selectedProject, currentUser, logoUrl, products]);

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
            {/* IMPORTANT: pass project via pdfProps.project (not selectedProject) */}
            <EstimatePDF {...pdfProps} />
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
