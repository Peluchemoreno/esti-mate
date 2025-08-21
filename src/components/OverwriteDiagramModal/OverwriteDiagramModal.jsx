import "./OverwriteDiagramModal.css";

export function OverwriteDiagramModal({ activeModal }) {
  return (
    <div
      className={
        activeModal === "confirmDiagramOverwrite"
          ? "modal modal_visible"
          : "modal"
      }
    >
      modal
    </div>
  );
}
