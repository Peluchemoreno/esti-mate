import "./Diagram.css";
import closeIcon from "../../assets/icons/close.svg";
import { useEffect, useRef } from "react";

export default function Diagram({ activeModal, closeModal }) {
  const ref = useRef()

  function drawGrid(context){
    clearCanvas()
    const canvas = ref.current;
    const canvasWidth = canvas?.clientWidth;
    const canvasHeight = canvas?.clientHeight;
    
    for (let x = 0; x <= canvasWidth; x += 12) {
      context.fillStyle = '#c2c2c2'
      context.moveTo(x, 0);
      context.lineTo(x, canvasHeight);
    }

    for (let y = 0; y <= canvasHeight; y += 12) {
      context.moveTo(0, y);
      context.lineTo(canvasWidth, y);
    }
    context.stroke()
  }
  
  
  useEffect(()=>{
    const canvas = ref.current;
    const context = canvas?.getContext('2d')
    drawGrid(context)
  }, [])

  function logPosition(e) {}

  function makeCircle(e){
    const canvas = ref.current;
    const context = canvas?.getContext('2d')
    context.moveTo(e.pageX, e.pageY)
    context.arc(e.pageX, e.pageY, 10, 0, 2 * Math.PI)
    context.fillStyle = 'black'
    context.fill()

  }


  function clearCanvas(){
    const canvas = ref.current;
    const context = canvas?.getContext('2d')
    context.clearRect(0,0,context.canvas.width, context.canvas.height)
    console.log('clear')
  }


  return (
    <div
      className={
        activeModal === "diagram" ? "diagram diagram_visible" : "diagram"
      }
    >
      <img
        onClick={()=>{
          closeModal();
        }}
        src={closeIcon}
        alt="close diagram"
        className="diagram__close"
      />
      <canvas
        width={window.innerWidth}
        height={window.innerHeight}
        ref={ref}
        onLoad={()=>{console.log('loaded')}}
        onMouseMoveCapture={logPosition}
        onClick={makeCircle}
        className="diagram__canvas"
      ></canvas>
    </div>
  );
}
