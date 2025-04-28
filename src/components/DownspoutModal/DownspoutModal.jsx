import "./DownspoutModal.css";
import closeButton from "../../assets/icons/close.svg";
import { useState, useEffect } from "react";

export default function DownspoutModal({
  setActiveModal,
  activeModal,
  setTool,
  setIsDownspoutModalOpen,
  addDownspout,
}) {
  const [ elbowSequence, setElbowSequence ] = useState('');
  const [ totalFootage, setTotalFootage ] = useState('');
  const [ splashBlock, setSplashBlock ] = useState(false);
  const [ rainBarrel, setRainBarrel ] = useState(false);
  const [ undergroundDrainage, setUndergroundDrainage ] = useState(false);
  const [ downspoutSize, setDownspoutSize ] = useState('2x3');
  const [ downspoutMaterial, setDownspoutMaterial ] = useState('aluminum');
  const [ footageIsValid, setFootageIsValid ] = useState(null);
  const [ elbowSequenceIsValid, setElbowSequenceIsValid ] = useState(true);

  useEffect(()=>{
    clearInputs()
    }, [activeModal])

  function handleDownspoutSubmit(e) {
    e.preventDefault();
    const downspoutData = {
      elbowSequence,
      totalFootage,
      splashBlock,
      rainBarrel,
      undergroundDrainage,
      downspoutSize,
      downspoutMaterial,
    }
    addDownspout(downspoutData);

    setActiveModal('diagram');
    setIsDownspoutModalOpen(false);
  }
  
  function handleChangeElbowSequence(e){
    validateElbowSequence(e.target.value);
    setElbowSequence(e.target.value);
  }

  function handleChangeTotalFootage(e){
    validateFootage(e.target.value);
    setTotalFootage(e.target.value);
  }

  function handleChangeDownspoutSize(e){
    setDownspoutSize(e.target.value);
  }

  function handleChangeDownspoutMaterial(e){
    setDownspoutMaterial(e.target.value);
  }

  function clearInputs(){
    setElbowSequence('');
    setTotalFootage('');
    setSplashBlock(false);
    setRainBarrel(false);
    setUndergroundDrainage(false);
    setDownspoutSize('2x3');
    setDownspoutMaterial('aluminum');
  }
  
  function disableCreateButton(){
    if (elbowSequence === '' || totalFootage === '' || totalFootage[0] === '0'){
      return true
    }

    if (!footageIsValid || !elbowSequenceIsValid){
      return true
    }
    
    return false;
  }

  function validateFootage(input){
    const pattern = /^[0-9]*$/;
    setFootageIsValid(pattern.test(input))
    return pattern.test(input);
  }

  function validateElbowSequence(input){
    const pattern = /^[A, a, B, b, C, c, 2, 4, 6]*$/;
    setElbowSequenceIsValid(pattern.test(input));
    console.log(pattern.test(input));
  }

  return (
    <div
      className={
        activeModal === "downspout"
          ? `modal downspout-modal modal_visible`
          : "modal downspout-modal"
      }
    >
      <form className="downspout-modal__form" onSubmit={handleDownspoutSubmit}>
        <header>
          <h2>Downspout Details</h2>
        </header>
        <div className="downspout-modal__body">
          <label className="add-item__label">
            Elbow Sequence: <span className={elbowSequenceIsValid === true ? 'elbow-sequence__input_visible' : 'elbow-sequence__input'}>Use: A, B, C, 2, 4, and 6 for elbows and offsets.</span>
            <span className={elbowSequenceIsValid === true || elbowSequenceIsValid === null ? 'elbow-sequence__input-error' : 'elbow-sequence__input-error_visible'}>Only accepts: A, B, C, 2, 4, and 6</span>
            <input
              className={elbowSequenceIsValid === false ? "add-item-name__input add-item-form__input add-item-form__input_error" : "add-item-name__input add-item-form__input"}
              type="text"
              onChange={handleChangeElbowSequence}
              value={elbowSequence}
              placeholder='Ex: AA62A, AAA, BB4A'
            />
          </label>
          <label className="add-item__label">
            Total Footage: <span className={footageIsValid === false ? 'footage-label-error_visible' : 'footage-label-error' }>Only input numbers.</span>
            <input
              className={footageIsValid === false ? "add-item-name__input add-item-form__input add-item-form__input_error" : "add-item-name__input add-item-form__input"}
              type="text"
              onChange={handleChangeTotalFootage}
              value={totalFootage}
            />
          </label>
          <label className="downspout__radio-label">
            Splash Block
            <div className="downspout-modal__div">
              <input name="splashBlock" type="radio" value="yes" onChange={()=>{setSplashBlock(true)}} checked={splashBlock === true}/> Yes
              <input
                className="downspout-modal__second-radio"
                name="splashBlock"
                type="radio"
                value="no"
                onChange={()=>{setSplashBlock(false)}}
                checked={splashBlock === false}
              />
              No
            </div>
          </label>
          <label className="downspout__radio-label">
            Rain Barrel
            <div className="downspout-modal__div">
              <input type="radio" name="rainBarrel" value="yes" onChange={()=>{setRainBarrel(true)}} checked={rainBarrel === true}/>
              Yes
              <input
                className="downspout-modal__second-radio"
                type="radio"
                name="rainBarrel"
                value="no"
                onChange={()=>{setRainBarrel(false)}}
                checked={rainBarrel === false}
              />
              No
            </div>
          </label>
          <label className="downspout__radio-label">
            Underground Drainage
            <div className="downspout-modal__div">
              <input type="radio" name="undergroundDrainage" value="yes" onChange={()=>{setUndergroundDrainage(true)}} checked={undergroundDrainage === true}/> Yes
              <input
                className="downspout-modal__second-radio"
                type="radio"
                name="undergroundDrainage"
                value="no"
                onChange={()=>{setUndergroundDrainage(false)}}
                checked={undergroundDrainage === false}
              />{" "}
              No
            </div>
          </label>
          <label className="downspout__drop-label">
            Downspout Size
            <select className='downspout__drop-input' onChange={handleChangeDownspoutSize} value={downspoutSize}>
              <option className='input__drop' value="2x3">2x3</option>
              <option className='input__drop' value="3x4">3x4</option>
              <option className='input__drop' value="4x5">4x5</option>
              <option className='input__drop' value='3" Round'>3" Round</option>
              <option className='input__drop' value='4" Round'>4" Round</option>
              <option className='input__drop' value="Box">Box</option>
            </select>
          </label>
          <label className="downspout__drop-label">
            Downspout Material
            <select className='downspout__drop-input' onChange={handleChangeDownspoutMaterial} value={downspoutMaterial}>
              <option className='input__drop' value="aluminum">Aluminum</option>
              <option className='input__drop' value="galvalume">Galvalume</option>
              <option className='input__drop' value="copper">Copper</option>
            </select>
          </label>
        </div>
        <div className="add-item-form__footer">
          <button
            onClick={() => {

              setIsDownspoutModalOpen(false);
              setTool('downspout'); // Or whatever tool you want to reset to
              setActiveModal('diagram');
            }}
            type="button"
            className="add-item-form__button_cancel"
          >
            Cancel
          </button>
          <button type="submit" className="add-item-form__button_create" disabled={disableCreateButton()}>
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
