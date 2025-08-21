import "./OverwriteDiagramModal.css";
import closeButton from "../../assets/icons/close.svg";

export function OverwriteDiagramModal({
  activeModal,
  setActiveModal,
  saveDiagram,
}) {
  return (
    <div
      className={
        activeModal === "confirmDiagramOverwrite"
          ? "modal diagram-confirm modal_visible"
          : "modal"
      }
    >
      <div className="diagram-confirm__content">
        <img
          src={closeButton}
          alt=""
          className="close-btn"
          onClick={() => {
            setActiveModal("diagram");
          }}
        />
        <h3 className="diagram-confirm__title">
          A change to the diagram was detected. Do you want to overwrite the
          current diagram or create a new diagram?
        </h3>
        <div className="diagram-confirm__buttons">
          <button
            className="button button_overwrite"
            onClick={() => {
              saveDiagram("overwrite");
            }}
          >
            Overwrite current diagram
          </button>
          <button
            className="button button_createNew"
            onClick={() => {
              saveDiagram("new");
            }}
          >
            Create new diagram
          </button>
        </div>
      </div>
    </div>
  );
}
