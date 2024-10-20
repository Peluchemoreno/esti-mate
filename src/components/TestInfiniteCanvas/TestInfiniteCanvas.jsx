import React, { useRef, useState, useEffect } from "react";

export default function InfiniteCanvas({ activeModal, closeModal, isMobile}) {
  const canvasRef = useRef(null);
  const [isPanning, setIsPanning] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Example of drawing a large grid on the canvas
    const drawGrid = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.strokeStyle = "#ddd";
      context.lineWidth = 1;
      const gridSize = 20;

      // Draw a large grid
      for (let x = -5000; x < 5000; x += gridSize) {
        context.moveTo(x + offsetX, -5000 + offsetY);
        context.lineTo(x + offsetX, 5000 + offsetY);
      }
      for (let y = -5000; y < 5000; y += gridSize) {
        context.moveTo(-5000 + offsetX, y + offsetY);
        context.lineTo(5000 + offsetX, y + offsetY);
      }
      context.stroke();
    };

    drawGrid();
  }, [offsetX, offsetY]);

  const handlePointerDown = (e) => {
    e.preventDefault();
    setIsPanning(true);
    setStartX(e.clientX || e.touches[0].clientX);
    setStartY(e.clientY || e.touches[0].clientY);
  };

  const handlePointerMove = (e) => {
    if (!isPanning) return;
    
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;

    setOffsetX((prevOffsetX) => prevOffsetX + (clientX - startX));
    setOffsetY((prevOffsetY) => prevOffsetY + (clientY - startY));

    setStartX(clientX);
    setStartY(clientY);
  };

  const handlePointerUp = () => {
    setIsPanning(false);
  };

  return (
    <div
    className={
      activeModal === "diagram" ? "diagram diagram_visible" : "diagram"
    }
    onDoubleClick={closeModal}
  >
    <div
      style={{ touchAction: "none" }} // This ensures touch events are not blocked
    >
      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        style={{ border: "1px solid black", backgroundColor: "white" }}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      />
    </div>
    </div>
  );
};

