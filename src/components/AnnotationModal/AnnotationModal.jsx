import "./AnnotationModal.css";
import closeButton from "../../assets/icons/close.svg";
import { useEffect, useState } from "react";

// Props:
// - activeModal: string ("note" opens)
// - setActiveModal: fn
// - onSubmit: fn(text)  <-- handles add OR update (decided by parent)
// - initialText: string <-- prefill when editing
// - mode: "create" | "edit"
export function AnnotationModal({
  activeModal,
  setActiveModal,
  onSubmit,
  initialText = "",
  mode = "create",
}) {
  const [textInput, setTextInput] = useState("");

  // prefill when opening / when initialText changes
  useEffect(() => {
    if (activeModal === "note") {
      setTextInput(initialText || "");
    }
  }, [activeModal, initialText]);

  function handleTextInputChange(e) {
    setTextInput(e.target.value);
  }

  function resetAndClose() {
    setTextInput("");
    setActiveModal("diagram");
  }

  const isOpen = activeModal === "note";
  const isEdit = mode === "edit";
  const title = isEdit ? "Update note" : "Add a note";
  const actionLabel = isEdit ? "Update Note" : "Add Note";

  return (
    <div className={isOpen ? "modal modal_visible" : "modal"}>
      <div className="diagram-confirm__content">
        <img
          src={closeButton}
          alt=""
          className="close-btn"
          onClick={resetAndClose}
        />
        <h3 className="diagram-confirm__title">{title}</h3>
        <label htmlFor="note">
          <input
            className="input add-note__input"
            type="text"
            name="note"
            id="note"
            onChange={handleTextInputChange}
            value={textInput}
          />
        </label>
        <div className="diagram-confirm__buttons">
          <button className="button button_overwrite" onClick={resetAndClose}>
            Cancel
          </button>
          <button
            className="button button_createNew"
            onClick={() => {
              const v = String(textInput || "").trim();
              if (v) onSubmit(v);
              resetAndClose();
            }}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
