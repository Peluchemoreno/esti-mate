import "./Diagram.css";
import closeIcon from "../../assets/icons/close.svg";
import saveIcon from '../../assets/icons/check.svg';
import trashIcon from '../../assets/icons/trash.svg'
import { useEffect, useRef, useState } from "react";

export default function Diagram({ activeModal, closeModal }) {
  const ref = useRef()
  
  const [paths, setPaths] = useState([])

  function drawGrid(){
    const canvas = ref.current;
    const context = canvas?.getContext('2d' ,{willReadFrequently: true })
    const canvasWidth = canvas?.clientWidth;
    const canvasHeight = window.innerHeight;

    
    for (let x = 0; x <= canvasWidth; x += 12) {
      context.moveTo(x, 0);
      context.lineTo(x, canvasHeight);
    }
    
    for (let y = 0; y <= canvasHeight; y += 12) {
      context.moveTo(0, y);
      context.lineTo(canvasWidth, y);
    }
    context.fillStyle = '#dfdfdf'
    context.fillRect(0, 0, canvasWidth, canvasHeight)
  }
  
  useEffect(()=>{
    drawGrid()
    console.log('drawing grid')
  }, [])
  

  function makeCircle(e){
    const canvas = ref.current;
    const context = canvas?.getContext('2d' ,{willReadFrequently: true })
    context.beginPath()
    context.moveTo(e.pageX, e.pageY)
    context.arc(e.pageX, e.pageY, 5, 0, 2 * Math.PI)
    context.fillStyle = 'black'
    context.fill()
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
    setPaths([...paths, imageData])
  }


  function clearCanvas(){
    const canvas = ref.current;
    const context = canvas?.getContext('2d' ,{willReadFrequently: true })
    context.clearRect(0,0,canvas.width, canvas.height)
    setPaths([])
  }

  return (
    <div
      className={
        activeModal === "diagram" ? "diagram diagram_visible" : "diagram"
      }
    >
      <div className="diagram__tools">
        <img
          onClick={()=>{
            closeModal();
          }}
          src={closeIcon}
          alt="close diagram"
          className="diagram__close diagram__icon"
        />
        <img src={saveIcon} alt="save digram" className="diagram__icon diagram__save" onClick={()=>{
          console.log('saving diagram')
        }}/>
        <img src={trashIcon} alt="clear diagram" className="diagram__icon diagram__trash" onClick={clearCanvas} />
      </div>
      
      <canvas
        width={window.innerWidth}
        height={window.innerHeight}
        ref={ref}
        className="diagram__canvas"
        onPointerDown={(e)=>{
          console.log(e.pageX, e.pageY)
        }}
      ></canvas>
    </div>
  );
}
