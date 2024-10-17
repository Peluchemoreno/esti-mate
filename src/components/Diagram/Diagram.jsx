import "./Diagram.css";
import closeIcon from "../../assets/icons/close.svg";
import saveIcon from "../../assets/icons/check.svg";
import trashIcon from "../../assets/icons/trash.svg";
import { useEffect, useRef, useState } from "react";
import itemsIcon from "../../assets/icons/items.svg";
import {
  isLineParallelToTop,
  isLineParallelToSide,
  calculateDistance,
} from "../../utils/constants";

const Diagram = ({ activeModal, closeModal }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState("line");
  const [gridSize, setGridSize] = useState(10);
  const [currentLine, setCurrentLine] = useState({
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
  });
  const [lines, setLines] = useState([]); // Array to store all drawn lines
  const [lineLength, setLineLength] = useState(0);

  useEffect(() => {
    drawGrid();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    drawAllLines(ctx); // Redraw all lines whenever currentLine or lines change
  }, [currentLine, lines, isDrawing]);

  /* ------------------------------------------------------------------------------------ */
  /*                            tightly coupled grid functions                            */
  /* ------------------------------------------------------------------------------------ */
  function convertToFeet(distance) {
    const feet = Math.round(distance / gridSize);

    return feet;
  }

  function snapNumberToGrid(number) {
    return Math.round(number / gridSize) * gridSize;
  }

  function drawGrid() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { willReadFrequently: true });
    const canvasWidth = canvas?.clientWidth;
    const canvasHeight = window.innerHeight;

    for (let x = 0; x <= canvasWidth; x += gridSize) {
      context.moveTo(x, 0);
      context.lineTo(x, canvasHeight);
    }

    for (let y = 0; y <= canvasHeight; y += gridSize) {
      context.moveTo(0, y);
      context.lineTo(canvasWidth, y);
    }
    context.fillStyle = "#dfdfdf";
    context.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  /* ------------------------------------------------------------------------------------ */
  /*                               event listeners                                        */
  /* ------------------------------------------------------------------------------------ */

  // Start drawing on mousedown
  function handleMouseDown(e) {
    const { offsetX, offsetY } = e.nativeEvent;

    setCurrentLine({
      startX: snapNumberToGrid(offsetX),
      startY: snapNumberToGrid(offsetY),
      endX: snapNumberToGrid(offsetX),
      endY: snapNumberToGrid(offsetY),
    });
    setIsDrawing(true);
  }

  // Update the line while dragging
  function handleMouseMove(e) {
    if (!isDrawing) return;

    const { offsetX, offsetY } = e.nativeEvent;
    setCurrentLine((prevLine) => ({
      ...prevLine,
      endX: snapNumberToGrid(offsetX),
      endY: snapNumberToGrid(offsetY),
    }));
    let pt1 = [currentLine.startX, currentLine.startY];
    let pt2 = [currentLine.endX, currentLine.endY];
    setLineLength(convertToFeet(calculateDistance(pt1, pt2)));
  }

  // Stop drawing on mouseup
  function handleMouseUp() {
    if (isDrawing) {
      setLines([...lines, currentLine]); // Save the current line
    }
    console.log(lineLength);

    isLineParallelToTop(
      currentLine.startX,
      currentLine.startY,
      currentLine.endX,
      currentLine.endY
    );
    isLineParallelToSide(
      currentLine.startX,
      currentLine.startY,
      currentLine.endX,
      currentLine.endY
    );
    setIsDrawing(false);
  }

  function drawAllLines(ctx) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); // Clear canvas

    // Draw each saved line
    lines.forEach(({ startX, startY, endX, endY }) => {
      drawLine(ctx, startX, startY, endX, endY);
    });
    // Draw the current line if it's being drawn
    if (isDrawing) {
      const { startX, startY, endX, endY } = currentLine;
      drawLine(ctx, startX, startY, endX, endY);
    }
  }

  // Draw a line on the canvas
  function drawLine(ctx, x1, y1, x2, y2) {
    x1 = Math.round(x1 / gridSize) * gridSize;
    y1 = Math.round(y1 / gridSize) * gridSize;
    x2 = Math.round(x2 / gridSize) * gridSize;
    y2 = Math.round(y2 / gridSize) * gridSize;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.closePath();
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { willReadFrequently: true });
    context.clearRect(0, 0, canvas.width, canvas.height);
    setLines([]);
    setLineLength(0);
  }

  return (
    <div
      className={
        activeModal === "diagram" ? "diagram diagram_visible" : "diagram"
      }
    >
      <div className="diagram__tools" selec>
        <img
          onClick={() => {
            closeModal();
          }}
          src={closeIcon}
          alt="close diagram"
          className="diagram__close diagram__icon"
        />
        <img
          src={saveIcon}
          alt="save digram"
          className="diagram__icon diagram__save"
          onClick={() => {
            console.log("saving diagram");
          }}
        />
        <img
          src={trashIcon}
          alt="clear diagram"
          className="diagram__icon diagram__trash"
          onClick={clearCanvas}
        />
        <img
          src={itemsIcon}
          alt="select product"
          className="diagram__icon diagram__items"
          onClick={() => {
            console.log("select tool");
          }}
        />
      </div>
      <div className="diagram__line-length-display">{lineLength}</div>

      <canvas
        ref={canvasRef}
        className="diagram__canvas"
        width={window.innerWidth}
        height={window.innerHeight}
        onPointerDown={handleMouseDown}
        onPointerMove={handleMouseMove}
        onPointerUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchCancel={handleMouseUp}
      />
    </div>
  );
};

export default Diagram;
