import "./AnnotationModal.css";
import closeButton from "../../assets/icons/close.svg";
import { useScrollTrigger } from "@mui/material";
import { useState } from "react";

export function AnnotationModal({ activeModal, setActiveModal, addNote }) {
  const [textInput, setTextInput] = useState("");

  function handleTextInputChange(e) {
    setTextInput(e.target.value);
  }

  function resetInputs() {
    setTextInput("");
  }

  function handleAddNote(note) {
    addNote(note);
  }

  return (
    <div className={activeModal === "note" ? "modal modal_visible" : "modal"}>
      <div className="diagram-confirm__content">
        <img
          src={closeButton}
          alt=""
          className="close-btn"
          onClick={() => {
            setActiveModal("diagram");
            resetInputs();
          }}
        />
        <h3 className="diagram-confirm__title">Add a note here</h3>
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
          <button
            className="button button_overwrite"
            onClick={() => {
              setActiveModal("diagram");
              resetInputs();
            }}
          >
            Cancel
          </button>
          <button
            className="button button_createNew"
            onClick={() => {
              handleAddNote(textInput);
              setActiveModal("diagram");
              resetInputs();
            }}
          >
            Add Note
          </button>
        </div>
      </div>
    </div>
  );
}
