import { useEffect } from "react";
import "./SelectedDownspoutModal.css";

export default function SelectedDownspoutModal({
  selectedLine,
  activeModal,
  setActiveModal,
}) {
  useEffect(() => {}, [selectedLine]);
  useEffect(() => {}, [selectedLine]);

  return (
    <div
      className={
        activeModal === "selectedLine" && selectedLine
          ? "selected-downspout-modal selected-downspout-modal_visible"
          : "selected-downspout-modal"
      }
    >
      {selectedLine && selectedLine.color ? (
        <>
          <p>Product: {selectedLine.currentProduct.name}</p>
          <p>Length: {selectedLine.measurement}'</p>
          <div>
            <p>Clean/Repair</p>
            <input
              className="selectedLine__input"
              type="range"
              min={0}
              max={selectedLine.measurement}
            />
          </div>
          <div>
            <p>Removal</p>
            <input
              className="selectedLine__input"
              type="range"
              min={0}
              max={selectedLine.measurement}
            />
          </div>
          <div>
            <p>Drip Edge</p>
            <input
              className="selectedLine__input"
              type="range"
              min={0}
              max={selectedLine.measurement}
            />
          </div>
          <div>
            <p>Screen</p>
            <input
              className="selectedLine__input"
              type="range"
              min={0}
              max={selectedLine.measurement}
            />
          </div>
        </>
      ) : (
        <p>Loading...</p>
      )}

      <button onClick={() => setActiveModal("diagram")}>close</button>
    </div>
  );
}
