import Modal from "react-modal";
import { PDFViewer } from "@react-pdf/renderer";
import { EstimatePDF } from "../EstimatePDF/EstimatePDF";

Modal.setAppElement("#root"); // Required for accessibility

const EstimateModal = ({ isOpen, onClose, estimate, project }) => {
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
        <EstimatePDF estimate={estimate} project={project} />
      </PDFViewer>
      <button onClick={onClose} style={{ marginTop: "20px" }}>
        Close
      </button>
    </Modal>
  );
};

export default EstimateModal;
