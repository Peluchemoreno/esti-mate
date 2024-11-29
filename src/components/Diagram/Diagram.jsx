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
import { getProducts } from "../../utils/api";

const Diagram = ({ activeModal, closeModal, isMobile}) => {
  /* ------------------------------------------------------------------------------------ */
  /*                               disable pinch zoom for ios                             */
  /* ------------------------------------------------------------------------------------ */
  // useEffect(() => {
  //   function preventZoom(e) {
  //     if (e.touches.length > 1) {
  //       e.preventDefault();
  //     }
  //   };

  //   document.addEventListener("touchmove", preventZoom, { passive: false });

  //   return () => {
  //     document.removeEventListener("touchmove", preventZoom);
  //   };
  // }, []);

  // console.log(productList)

  /* ------------------------------------------------------------------------------------ */
  /*                                     render canvas                                    */
  /* ------------------------------------------------------------------------------------ */
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
  const [tool, setTool] = useState('');
  const [unitPerTools, setUnitPerTools] = useState([])
  const [products, setProducts] = useState([])
 
  useEffect(()=>{
    const token = localStorage.getItem('jwt')
    getProducts(token)
    .then(data => {
      const products = data.products
      setProducts(products)
      setTool(products[0].name)
    })
  }, [activeModal])


  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    // Adjust for device pixel ratio
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    context.scale(dpr, dpr);

    // drawGrid(); // Redraw the grid after scaling
  }, []);

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

  // function drawGrid() {
  //   const canvas = canvasRef.current;
  //   const context = canvas?.getContext("2d", { willReadFrequently: true });
  //   const canvasWidth = canvas?.clientWidth;
  //   const canvasHeight = window.innerHeight;

  //   for (let x = 0; x <= canvasWidth; x += gridSize) {
  //     context.moveTo(x, 0);
  //     context.lineTo(x, canvasHeight);
  //   }

  //   for (let y = 0; y <= canvasHeight; y += gridSize) {
  //     context.moveTo(0, y);
  //     context.lineTo(canvasWidth, y);
  //   }
  //   // context.fillStyle = "#dfdfdf";
  //   context.strokeStyle = "red";
  //   context.stroke();
  //   // context.fillRect(0, 0, canvasWidth, canvasHeight);
  // }

  /* ------------------------------------------------------------------------------------ */
  /*                               event listeners                                        */
  /* ------------------------------------------------------------------------------------ */

  // function handleMouseDown(e) {
  //   let offsetX, offsetY;
  //   if (e.nativeEvent?.touches) {
  //     const touch = e.nativeEvent.touches[0]; // Get the first touch point
  //     const canvas = canvasRef.current;
  //     const rect = canvas.getBoundingClientRect();
  //     offsetX = touch.clientX - rect.left;
  //     offsetY = touch.clientY - rect.top;
  //   } else {
  //     // Mouse event
  //     offsetX = e.offsetX;
  //     offsetY = e.offsetY;
  //   }

  //   setCurrentLine({
  //     startX: snapNumberToGrid(offsetX),
  //     startY: snapNumberToGrid(offsetY),
  //     endX: snapNumberToGrid(offsetX),
  //     endY: snapNumberToGrid(offsetY),
  //     isVertical: false,
  //     isHorizontal: false,
  //     isSelected: false,
  //     color: "black",
  //     product: productList.filter(product => {
  //       return product.name === tool
  //     })
  //   });
  //   setIsDrawing(true);
  // }


  function handleMouseDown(e) {
    const currentProduct = products.find(product => product.name === tool)
    

    // if (currentProduct?.quantity === 'unit-per'){
    //   let offsetX, offsetY;
    //   if (e.nativeEvent?.touches) {
    //     const touch = e.nativeEvent.touches[0];
    //     const canvas = canvasRef.current;
    //     const rect = canvas.getBoundingClientRect();
    //     offsetX = touch.clientX - rect.left;
    //     offsetY = touch.clientY - rect.top;
    //   } else {
    //     offsetX = e.offsetX;
    //     offsetY = e.offsetY;
    //   }

  
    //   // write logic for using tools that dont require drawing, only placing

    // }

    let offsetX, offsetY;
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
    
    setCurrentLine({
      startX: snapNumberToGrid(offsetX),
      startY: snapNumberToGrid(offsetY),
      endX: snapNumberToGrid(offsetX),
      endY: snapNumberToGrid(offsetY),
      isVertical: false,
      isHorizontal: false,
      isSelected: false,
      color: 'black',
      // product: currentProduct, // Directly assign the selected product object here
    });
    setIsDrawing(true);
  }
  
  function handleMouseMove(e) {
    if (!isDrawing) return;

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
        color: "green",
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
    const currentProduct = products?.find(product => product.name === tool)
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
      currentLine.color = currentProduct?.visual      
      const updatedLine = {...currentLine};
      updatedLine.currentProduct = currentProduct

      console.log(updatedLine)
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

  function drawAllLines(ctx) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); // Clear canvas

    // Draw each saved line or product using its own properties
    lines.forEach((line) => {
      
      line.product = currentLine[0]
      drawLine(ctx, line);
    });
    
    // Draw the current line if it's being drawn
    if (isDrawing) {
      drawLine(ctx, currentLine); // Draw current line in-progress
    }
  }
  

  function drawLine(ctx, line) {
    const { startX, startY, endX, endY, midpoint, measurement, color, product } = line;
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
    ctx.strokeStyle = color; // Use the line's specific color
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.closePath();

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

  function handleToolSelectChange(e){
    const selectedTool = e.target.value
    setTool(selectedTool)
    // const currentProduct = products.find(product => product.name === selectedTool)
    // setSelectedProduct(currentProduct)
  }

  function saveDiagram(){
    console.log("saving diagram");
    let totalFootage = 0;
    let price = 0;
    // let miters = 0
    lines.forEach((line) => {
      totalFootage += line.measurement;
      price += (convertToPriceInCents(line.currentProduct.price) * line.measurement)
    });
  
    console.log(`${totalFootage}'`);
    console.log(lines);
    console.log('$' + (price * .01).toFixed(2))
  }

  function convertToPriceInCents(string){
    return parseInt(string.replace('$', '').replace('.', ''))
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
          }}
          src={closeIcon}
          alt="close diagram"
          className="diagram__close diagram__icon"
        />
        <img
          src={saveIcon}
          alt="save digram"
          className="diagram__icon diagram__save"
          onClick={saveDiagram}
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
        <select value={tool} onChange={handleToolSelectChange} className="diagram__select-product" name="select product dropdown" id="select-product-dropdown" defaultValue={products[0]?.name}>
          {products.map(product => {
            return (
              <option style={{
                backgroundColor: `${product.visual}`
              }} value={product.name} key={product._id}>{product.name}</option>
            )
          })}
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
