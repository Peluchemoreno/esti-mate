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
import DownspoutModal from "../DownspoutModal/DownspoutModal";

const Diagram = ({
  activeModal,
  closeModal,
  isMobile,
  currentProjectId,
  addDiagramToProject,
  handlePassDiagramData,
  selectedDiagram,
  setSelectedDiagram,
  originalDiagram,
  setActiveModal,
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
  const [downspoutCoordinates, setDownspoutCoordinates] = useState([0, 0]);
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
  const [isDownspoutModalOpen, setIsDownspoutModalOpen] = useState(false);
  const [unfilteredProducts, setUnfilteredProducts] = useState([]);

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
      if (data.products) {
        const products = data.products;
        setUnfilteredProducts(data.products);
        const filteredProducts = products.filter((product) => product.listed);
        setProducts(filteredProducts);

        // Important: only set default tool once when products load

if (filteredProducts.length > 0 && tool === "") {
  setTool(filteredProducts[0].name);
}
      } else {
        setProducts([
          {
            name: "Test",
            visual: "#badbad",
            price: "0.00",
            quantity: "length/feet",
          },
        ]);
      }
    });
  }, [activeModal]); // <-- empty dependency array: only runs once on first mount

  useEffect(() => {
    setLines((prevLines) =>
      prevLines.map((line) => ({ ...line, isSelected: false })),
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
      prevLines.map((line) => ({ ...line, isSelected: false })),
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

  function handleAddDownspout(downspoutData) {
    const currentDownspout = unfilteredProducts.filter((product)=> {
      return (product.name === downspoutData.downspoutSize + ' Downspout') || product.name === downspoutData.downspoutSize + ' downspout'
    })

    const formattedDownspout = {
      startX: downspoutCoordinates[0],
      startY: downspoutCoordinates[1],
      endX: downspoutCoordinates[0],
      endY: downspoutCoordinates[1],
      midpoint: null,
      measurement: parseInt(downspoutData.totalFootage),
      color: currentDownspout[0].visual, 
      isSelected: false,
      isDownspout: true,
      price: currentDownspout[0].price,
      elbowSequence: downspoutData.elbowSequence,
      downspoutSize: downspoutData.downspoutSize,
      currentProduct: {price: currentDownspout[0].price,
      name: downspoutData.downspoutSize + ' Downspout'},
    }
    setLines([...lines, formattedDownspout]);
  }

  /* ------------------------------------------------------------------------------------ */
  /*                               event listeners                                        */
  /* ------------------------------------------------------------------------------------ */

  
function handleMouseDown(e) {
  if (isDownspoutModalOpen) return;
  
  let offsetX, offsetY;
  let foundLine = null;

  if (e.nativeEvent?.touches) {
    const touch = e.nativeEvent.touches[0];
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    offsetX = touch.clientX - rect.left;
    offsetY = touch.clientY - rect.top;
  } else if (e.nativeEvent) {
    offsetX = e.nativeEvent.offsetX;
    offsetY = e.nativeEvent.offsetY;
  } else {
    console.error("Mouse event missing nativeEvent offsets");
    return;
  }

  if (tool === "downspout") {
    const snappedX = snapNumberToGrid(offsetX);
    const snappedY = snapNumberToGrid(offsetY);

    setDownspoutCoordinates([snappedX, snappedY]);
    console.log("Opening Downspout modal at:", [snappedX, snappedY]);

    setIsDownspoutModalOpen(true);
    setActiveModal("downspout");
    return;
  } 
  
  else if (tool === "select") {
    console.log("Selecting mode active");

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
          snapNumberToGrid(offsetX),
          snapNumberToGrid(offsetY),
          5,
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
            : line,
        ),
      );
      setSelectedLine(foundLine);
      console.log("Selected line:", foundLine);
      console.log(lines);
    } else {
      console.log("No line found near click");
      setSelectedLine({});
    }
  } 
  
  else {
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
    if (isDownspoutModalOpen) return;
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
        currentLine.endY,
      ) ||
      isLineParallelToTop(
        currentLine.startX,
        currentLine.startY,
        currentLine.endX,
        currentLine.endY,
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
    if (isDownspoutModalOpen) return;
    const currentProduct = products?.find((product) => product.name === tool);
    if (tool === "select") {
      console.log("mouseup select");
      setIsDrawing(false);
      return;
    }

    if (tool === "downspout") {
      console.log("ds select");
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
          currentLine.endY,
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
          currentLine.endY,
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
      isDownspout,
    } = line;
    // console.log(product)
    // Snap coordinates to the grid
    const x1 = Math.round(startX / gridSize) * gridSize;
    const y1 = Math.round(startY / gridSize) * gridSize;
    const x2 = Math.round(endX / gridSize) * gridSize;
    const y2 = Math.round(endY / gridSize) * gridSize;

    if (isDownspout) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + gridSize / 2.75, y1 + gridSize / 2.75);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - gridSize / 2.75, y1 + gridSize / 2.75);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - gridSize / 2.75, y1 - gridSize / 2.75);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + gridSize / 2.75, y1 - gridSize / 2.75);
      ctx.strokeStyle = line.color;
      ctx.stroke();
    } else {
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
    if (lines.length === 0) {
      closeModal();
      return;
    }
    

  // Check if diagram actually changed
  const hasChanged = JSON.stringify(lines) !== JSON.stringify(originalDiagram.lines);

  if (!hasChanged) {
    console.log("No changes detected, not saving.");
    closeModal();
    return;
  }

    function getBoundingBox(lines, padding = 20) {  // <-- 🔥 add a default padding value
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      lines.forEach((line) => {
        minX = Math.min(minX, line.startX, line.endX);
        minY = Math.min(minY, line.startY, line.endY);
        maxX = Math.max(maxX, line.startX, line.endX);
        maxY = Math.max(maxY, line.startY, line.endY);
      });

      // Expand the box by padding
      return {
        minX: minX - padding,
        minY: minY - padding,
        maxX: maxX + padding,
        maxY: maxY + padding,
      };
    }

    const token = localStorage.getItem("jwt");
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    drawAllLines(ctx);

    const boundingBox = getBoundingBox(lines, 30);
    const cropWidth = boundingBox.maxX - boundingBox.minX;
    const cropHeight = boundingBox.maxY - boundingBox.minY;

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');

  
    const thumbnailDisplaySize = 200; // what you want it to *look* like
    const thumbnailInternalSize = 3 * thumbnailDisplaySize; // 2x pixel density for crispness

    tempCanvas.width = thumbnailInternalSize;
    tempCanvas.height = thumbnailInternalSize;
    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    const padding = 0.05 * thumbnailInternalSize; // padding based on bigger internal size

    const availableWidth = thumbnailInternalSize - padding * 2;
    const availableHeight = thumbnailInternalSize - padding * 2;

    const scale = Math.min(availableWidth / cropWidth, availableHeight / cropHeight);

    const destWidth = cropWidth * scale;
    const destHeight = cropHeight * scale;

    const dx = (thumbnailInternalSize - destWidth) / 2;
    const dy = (thumbnailInternalSize - destHeight) / 2;

    tempCtx.fillStyle = "#ffffff"; // optional background
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    tempCtx.drawImage(
      canvas,
      boundingBox.minX,
      boundingBox.minY,
      cropWidth,
      cropHeight,
      dx,
      dy,
      destWidth,
      destHeight
    );

    const thumbnailDataUrl = tempCanvas.toDataURL('image/png');
    let totalFootage = 0;
    let price = 0;
    let downspoutCentsPrice;

    lines.forEach((line) => {
      if (line.isDownspout){
        const downspoutPrice = (parseFloat(line.price.slice(1))).toFixed(2);
        downspoutCentsPrice = parseInt(((line.measurement * downspoutPrice) * 100).toFixed(0));
        price += downspoutCentsPrice;
      } else {
      totalFootage += line.measurement;
      price +=
        convertToPriceInCents(line.currentProduct.price) * line.measurement;
}
          });

    const totalPrice = "$" + (price * 0.01).toFixed(2);

    const data = {
      lines: [...lines],
      imageData: thumbnailDataUrl,
      totalFootage,
      price: totalPrice,
    };

    console.log(totalPrice);
    console.log(thumbnailDataUrl);

    addDiagramToProject(currentProjectId, token, data)
      .then((newDiagramData) => {
        handlePassDiagramData(newDiagramData);
        // ✅ Optional: Update selected diagram if needed
        // setSelectedDiagram(newDiagramData);
        // clearCanvas();
        closeModal();
      }).then(()=>{
        clearCanvas()
      })
      .catch((err) => {
        console.error("Failed to save diagram:", err);
        closeModal();
      });
  }

  function convertToPriceInCents(string) {
    return parseInt(string.replace("$", "").replace(".", ""));
  }

  return (
    <>
      <div
        className={
          activeModal === "diagram" || activeModal === "downspout"
            ? "diagram diagram_visible"
            : "diagram"
        }
      >
        <img
          onClick={() => {
            setSelectedDiagram({});
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
          {products?.map((product) => {
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
      <DownspoutModal
        setActiveModal={setActiveModal}
        activeModal={activeModal}
        setTool={setTool}
        setIsDownspoutModalOpen={setIsDownspoutModalOpen}
        addDownspout={handleAddDownspout}
      />
    </>
  );
};

export default Diagram;
