import Modal from "react-modal";
import { PDFViewer } from "@react-pdf/renderer";
import { EstimatePDF } from "../EstimatePDF/EstimatePDF";
import { useEffect, useState } from "react";
import { BASE_URL } from "../../utils/constants";
import { getCompanyLogo } from "../../utils/auth";

Modal.setAppElement("#root"); // Required for accessibility

const EstimateModal = ({
  isOpen,
  onClose,
  estimate,
  project,
  selectedDiagram,
  activeModal,
  currentUser,
}) => {
  const [logoUrl, setLogoUrl] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("jwt");

    fetch(`${BASE_URL}users/${currentUser._id}/logo`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.blob())
      .then((blob) => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result); // ✅ use full result, untouched
          reader.onerror = reject;
          reader.readAsDataURL(blob); // ✅ will auto-include proper MIME
        });
      })
      .then((base64Image) => {
        setLogoUrl(base64Image); // no string splitting!
      })
      .catch((err) => console.error("Failed to fetch and convert logo:", err));
  }, [activeModal]);

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Estimate Preview"
      style={{
        overlay: { backgroundColor: "rgba(0, 0, 0, 0.5)" },
        content: {
          width: "60%",
          height: "80%",
          margin: "auto",
          padding: "20px",
          borderRadius: "10px",
        },
      }}
    >
      <h2>Estimate Preview</h2>
      <PDFViewer width="100%" height="500px">
        <EstimatePDF
          key={selectedDiagram?._id}
          estimate={estimate}
          project={project}
          selectedDiagram={selectedDiagram}
          activeModal={activeModal}
          currentUser={currentUser}
          logoUrl={logoUrl}
        />
      </PDFViewer>
      <button onClick={onClose} style={{ marginTop: "20px" }}>
        Close
      </button>
    </Modal>
  );
};

export default EstimateModal;
