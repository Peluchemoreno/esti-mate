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
  isLineNearPoint,
} from "../../utils/constants";
import { getProducts } from "../../utils/api";
import { useParams } from "react-router-dom";

const Diagram = ({
  activeModal,
  closeModal,
  isMobile,
  currentProjectId,
  addDiagramToProject,
  handlePassDiagramData,
  selectedDiagram,
  setSelectedDiagram,
}) => {
  const params = useParams();

  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [gridSize, setGridSize] = useState(10);
  const [currentLine, setCurrentLine] = useState({
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    isHorizontal: false,
    isVertical: false,
    isSelected: false,
    color: "blue",
  });
  const [lines, setLines] = useState([]); // Array to store all drawn lines
  const [lineLength, setLineLength] = useState(0);
  const canvasBaseMeasurements = {
    top: 0,
    left: 0,
    width: window.innerWidth,
    height: window.innerHeight,
  };
  const [productsVisible, setProductsVisible] = useState(true);
  const [tool, setTool] = useState("");
  const [unitPerTools, setUnitPerTools] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedLine, setSelectedLine] = useState({});

  // useEffect(() => {
  //   const canvas = canvasRef.current;
  //   const ctx = canvas.getContext("2d");

  //   const newLines = selectedDiagram?.lines;
  //   if (newLines !== undefined) {
  //     console.log("selected diagram: ", newLines);
  //     newLines?.forEach((line) => {
  //       console.log("drawing line: ", line);
  //       drawLine(ctx, line);
  //     });
  //   }
  // }, [selectedDiagram, activeModal]);

  // useEffect(() => {
  //   const canvas = canvasRef.current;
  //   const ctx = canvas?.getContext("2d");

  //   if (!ctx) return;

  //   ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas before drawing

  //   const newLines = selectedDiagram?.lines;
  //   if (newLines) {
  //     console.log("selected diagram: ", newLines);
  //     newLines.forEach((line) => {
  //       console.log("drawing line: ", line);
  //       drawLine(ctx, line);
  //     });
  //   }
  // }, [selectedDiagram, activeModal]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if (!ctx) return;

    // setTimeout(() => {
    //   selectedDiagram?.lines?.forEach((line) => {
    //     drawLine(ctx, line);
    //   });
    // }, 0);
    selectedDiagram?.lines?.forEach((line) => {
      drawLine(ctx, line);
    });

    setLines(selectedDiagram.lines || []);
  }, [selectedDiagram]);

  useEffect(() => {
    const token = localStorage.getItem("jwt");
    getProducts(token).then((data) => {
      const products = data.products;
      setProducts(products);
      setTool(products[0].name);
    });

    setLines((prevLines) =>
      prevLines.map((line) => ({ ...line, isSelected: false }))
    );
    setSelectedLine({});
  }, [activeModal]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    // Adjust for device pixel ratio
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    context.scale(dpr, dpr);

    drawGrid(context); // Redraw the grid after scaling
  }, [window.innerWidth, window.innerHeight]);

  useEffect(() => {
    const canvas = canvasRef.current;

    // Fallback for touch or mouse events
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);

    canvas.addEventListener("touchstart", handleMouseDown);
    canvas.addEventListener("touchmove", handleMouseMove);
    canvas.addEventListener("touchend", handleMouseUp);

    return () => {
      // Cleanup
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("touchstart", handleMouseDown);
      canvas.removeEventListener("touchmove", handleMouseMove);
      canvas.removeEventListener("touchend", handleMouseUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    drawAllLines(ctx); // Redraw all lines whenever currentLine or lines change
  }, [currentLine, lines, isDrawing, selectedLine]);

  useEffect(() => {
    // Deselect all lines when the tool changes
    setLines((prevLines) =>
      prevLines.map((line) => ({ ...line, isSelected: false }))
    );
    setSelectedLine({});
  }, [tool]);

  /* ------------------------------------------------------------------------------------ */
  /*                            tightly coupled grid functions                            */
  /* ------------------------------------------------------------------------------------ */
  function drawGrid(ctx) {
    const { width, height } = ctx.canvas;
    const gridSize = 10; // Adjust grid size as needed

    // ctx.strokeStyle = "#ddd"; // Light gray grid lines
    ctx.strokeStyle = "#ccc";
    ctx.lineWidth = 1;

    // Draw vertical grid lines
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Draw horizontal grid lines
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  function convertToFeet(distance) {
    const feet = Math.round(distance / gridSize);

    return feet;
  }

  function snapNumberToGrid(number) {
    return Math.round(number / gridSize) * gridSize;
  }

  /* ------------------------------------------------------------------------------------ */
  /*                               event listeners                                        */
  /* ------------------------------------------------------------------------------------ */

  function handleMouseDown(e) {
    let offsetX, offsetY;
    let foundLine = null;

    if (e.nativeEvent?.touches) {
      const touch = e.nativeEvent.touches[0];
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      offsetX = touch.clientX - rect.left;
      offsetY = touch.clientY - rect.top;
    } else {
      offsetX = e.offsetX;
      offsetY = e.offsetY;
    }

    if (tool === "downspout") {
      console.log("open the downspout modal here", [
        snapNumberToGrid(e.offsetX),
        snapNumberToGrid(e.offsetY),
      ]);
    } else if (tool === "select") {
      console.log("Selecting mode active");

      // Reset all lines to not be selected
      const updatedLines = lines.map((line) => ({
        ...line,
        isSelected: false,
      }));

      updatedLines.forEach((line) => {
        if (
          isLineNearPoint(
            line.startX,
            line.startY,
            line.endX,
            line.endY,
            snapNumberToGrid(e.pageX),
            snapNumberToGrid(e.pageY),
            5
          )
        ) {
          foundLine = { ...line, isSelected: true };
        }
      });

      if (foundLine) {
        setLines(
          updatedLines.map((line) =>
            line.startX === foundLine.startX && line.startY === foundLine.startY
              ? foundLine
              : line
          )
        );
        setSelectedLine(foundLine);
        console.log("Selected line:", foundLine);
        console.log(lines);
      } else {
        console.log("No line found near click");
        setSelectedLine({});
      }
    } else {
      setCurrentLine({
        startX: snapNumberToGrid(offsetX),
        startY: snapNumberToGrid(offsetY),
        endX: snapNumberToGrid(offsetX),
        endY: snapNumberToGrid(offsetY),
        isVertical: false,
        isHorizontal: false,
        isSelected: false,
        color: "black",
      });
      setIsDrawing(true);
    }
  }

  function handleMouseMove(e) {
    if (!isDrawing || tool === "downspout" || tool === "select") return;

    let offsetX, offsetY;
    if (e.nativeEvent?.touches) {
      const touch = e.nativeEvent?.touches[0];

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      offsetX = touch.clientX - rect.left;
      offsetY = touch.clientY - rect.top;
    } else {
      // Mouse event
      offsetX = e.nativeEvent?.offsetX;
      offsetY = e.nativeEvent?.offsetY;
    }

    if (
      isLineParallelToSide(
        currentLine.startX,
        currentLine.startY,
        currentLine.endX,
        currentLine.endY
      ) ||
      isLineParallelToTop(
        currentLine.startX,
        currentLine.startY,
        currentLine.endX,
        currentLine.endY
      )
    ) {
      setCurrentLine((prevLine) => ({
        ...prevLine,
        endX: snapNumberToGrid(offsetX),
        endY: snapNumberToGrid(offsetY),
        color: "#14c414",
      }));
    } else {
      setCurrentLine((prevLine) => ({
        ...prevLine,
        endX: snapNumberToGrid(offsetX),
        endY: snapNumberToGrid(offsetY),
        color: "black",
      }));
    }

    let pt1 = [currentLine.startX, currentLine.startY];
    let pt2 = [currentLine.endX, currentLine.endY];
    setLineLength(convertToFeet(calculateDistance(pt1, pt2)));
  }

  // Stop drawing on mouseup
  function handleMouseUp(e) {
    const currentProduct = products?.find((product) => product.name === tool);
    if (tool === "select") {
      console.log("mouseup select");
      setIsDrawing(false);
      return;
    }

    if (e.nativeEvent?.touches) {
      let offsetX, offsetY;
      const touch = e.nativeEvent?.touches[0];

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      offsetX = touch?.clientX - rect.left;
      offsetY = touch?.clientY - rect.top;
    }

    currentLine.midpoint = [
      (currentLine.startX + currentLine.endX) / 2,
      (currentLine.startY + currentLine.endY) / 2,
    ];
    currentLine.measurement = lineLength;

    if (isDrawing) {
      if (
        isLineParallelToSide(
          currentLine.startX,
          currentLine.startY,
          currentLine.endX,
          currentLine.endY
        )
      ) {
        currentLine.isVertical = true;
        currentLine.isHorizontal = false;
        if (currentLine.midpoint[0] >= canvasBaseMeasurements.width / 2) {
          currentLine.position = "right";
        } else {
          currentLine.position = "left";
        }
      } else if (
        isLineParallelToTop(
          currentLine.startX,
          currentLine.startY,
          currentLine.endX,
          currentLine.endY
        )
      ) {
        currentLine.isHorizontal = true;
        currentLine.isVertical = false;
        if (currentLine.midpoint[1] <= canvasBaseMeasurements.height / 2) {
          currentLine.position = "top";
        } else {
          currentLine.position = "bottom";
        }
      } else {
        currentLine.isVertical = false;
        currentLine.isHorizontal = false;
      }

      currentLine.color = currentProduct?.visual;
      const updatedLine = { ...currentLine };
      updatedLine.currentProduct = currentProduct;

      setLines([...lines, updatedLine]); // Save the current line
    }

    setIsDrawing(false);
    setLineLength(0);
  }

  function placeMeasurement(line, measurement, x, y) {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    context.font = "900 12px Arial";
    context.textAlign = "center";
    context.fillStyle = "black";

    if (line.isHorizontal) {
      if (line.position === "top") {
        context.fillText(measurement.toString() + "'", x, y - gridSize / 1.5);
      } else if (line.position === "bottom") {
        context.fillText(measurement.toString() + "'", x, y + gridSize * 1.5);
      }
    }

    if (line.isVertical) {
      if (line.position === "left") {
        context.fillText(measurement.toString() + "'", x - gridSize / 0.75, y);
      } else if (line.position === "right") {
        context.fillText(measurement.toString() + "'", x + gridSize * 1.25, y);
      }
    }

    if (!line.isVertical && !line.isHorizontal) {
      context.fillText(measurement.toString() + "'", x, y - gridSize / 1.5);
    }
  }

  function renderSelectedDiagram(ctx, diagram) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); // Clear canvas
    drawGrid(ctx);
    diagram?.forEach((line) => {
      console.log(line);
      drawLine(ctx, line);
    });
  }

  function drawAllLines(ctx) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); // Clear canvas
    drawGrid(ctx);
    // Draw each saved line or product using its own properties
    lines.forEach((line) => {
      line.product = currentLine[0];
      drawLine(ctx, line);
    });

    // Draw the current line if it's being drawn
    if (isDrawing) {
      drawLine(ctx, currentLine); // Draw current line in-progress
    }
  }

  function drawLine(ctx, line) {
    const {
      startX,
      startY,
      endX,
      endY,
      midpoint,
      measurement,
      color,
      isSelected,
    } = line;
    // console.log(product)
    // Snap coordinates to the grid
    const x1 = Math.round(startX / gridSize) * gridSize;
    const y1 = Math.round(startY / gridSize) * gridSize;
    const x2 = Math.round(endX / gridSize) * gridSize;
    const y2 = Math.round(endY / gridSize) * gridSize;

    // Draw the line
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    if (isSelected) {
      ctx.strokeStyle = "orange";
      ctx.fillStyle = "orange";
    } else {
      ctx.strokeStyle = color; // Use the line's specific color
    }
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.closePath();

    if (isSelected) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.arc(x1, y1, gridSize / 2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.moveTo(x2, y2);
      ctx.arc(x2, y2, gridSize / 2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    }

    // Place the measurement if available
    if (midpoint && measurement) {
      placeMeasurement(line, measurement, midpoint[0], midpoint[1]);
    }
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { willReadFrequently: true });
    context.clearRect(0, 0, canvas.width, canvas.height);
    setLines([]);
    setLineLength(0);
  }

  function handleToolSelectChange(e) {
    const selectedTool = e.target.value;
    setTool(selectedTool);
    // const currentProduct = products.find(product => product.name === selectedTool)
    // setSelectedProduct(currentProduct)
  }

  function saveDiagram() {
    const token = localStorage.getItem("jwt");

    const canvas = canvasRef.current;
    const imageData = canvas.toDataURL("image/png");

    let totalFootage = 0;
    let price = 0;

    lines.forEach((line) => {
      totalFootage += line.measurement;
      price +=
        convertToPriceInCents(line.currentProduct.price) * line.measurement;
    });

    const totalPrice = "$" + (price * 0.01).toFixed(2);

    const data = {
      lines: [...lines], // ✅ This forces a React re-render
      imageData,
      totalFootage,
      price: totalPrice,
    };

    clearCanvas();
    closeModal();
    setSelectedDiagram({});

    addDiagramToProject(currentProjectId, token, data).then((data) => {
      handlePassDiagramData(data);
    });
  }

  function convertToPriceInCents(string) {
    return parseInt(string.replace("$", "").replace(".", ""));
  }

  return (
    <>
      <div
        className={
          activeModal === "diagram" ? "diagram diagram_visible" : "diagram"
        }
      >
        <img
          onClick={() => {
            closeModal();
            setSelectedDiagram({});
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
            // saveDiagram().then((data) => {
            //   setDiagrams((previousData) => [...previousData, data]);
            // });
            saveDiagram();
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
            setProductsVisible(true);
          }}
        />
        <select
          value={tool}
          onChange={handleToolSelectChange}
          className="diagram__select-product"
          name="select product dropdown"
          id="select-product-dropdown"
          defaultValue={products[0]?.name}
        >
          {products.map((product) => {
            return (
              <option
                style={{
                  backgroundColor: `${product.visual}`,
                }}
                value={product.name}
                key={product._id}
              >
                {product.name}
              </option>
            );
          })}
          <option value="downspout">Downspout</option>
          <option value="select">Select</option>
        </select>

        <div className="diagram__line-length-display">
          Current line length: {lineLength}'
        </div>

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
          onTouchEnd={handleMouseUp}
        />
      </div>
    </>
  );
};

export default Diagram;
