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

  const [estimateData, setEstimateData] = useState({
    estimateNumber: "001",
    estimateDate: new Date().toISOString().split("T")[0],
    paymentDue: "Upon completion",
    notes: "",
  });

  useEffect(() => {
    if (selectedDiagram?.lines) {
      setEditableLines(
        selectedDiagram.lines.map((line) => ({
          ...line,
          overrideName: line.currentProduct?.name || "",
          overridePrice: line.currentProduct?.price || "$0.00",
          overrideQuantity: line.measurement || 0,
        }))
      );
    }
  }, [selectedDiagram]);

  const [editableLines, setEditableLines] = useState(
    selectedDiagram?.lines || []
  );

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
      <div className="estimate-edit-form">
        <label>
          Estimate Number:
          <input
            type="text"
            value={estimateData.estimateNumber}
            style={{color: 'white'}}
            onChange={(e) =>
              setEstimateData({ ...estimateData, estimateNumber: e.target.value })
            }
          />
        </label>
        
        <label>
          Payment Terms:
          <input
            type="text"
            value={estimateData.paymentDue}
            style={{color: 'white'}}
            onChange={(e) =>
              setEstimateData({ ...estimateData, paymentDue: e.target.value })
            }
          />
        </label>
        <label>
          Notes:
          <textarea
            value={estimateData.notes}
            style={{color: 'white'}}
            onChange={(e) =>
              setEstimateData({ ...estimateData, notes: e.target.value })
            }
          />
        </label>
      </div>  

      <PDFViewer style={{ width: "100%", height: "90vh" }}>
       
      
        <EstimatePDF
          key={selectedDiagram?._id}
          estimate={estimate}
          project={project}
          selectedDiagram={selectedDiagram}
          activeModal={activeModal}
          currentUser={currentUser}
          logoUrl={logoUrl}
          estimateData={estimateData}
        />
      </PDFViewer>
      <button onClick={onClose} style={{ marginTop: "20px" }}>
        Close
      </button>
    </Modal>
  );
};

export default EstimateModal;
