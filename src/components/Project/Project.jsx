import "./Project.css";
import { useParams } from "react-router-dom";
import backIcon from "../../assets/icons/back.svg"
import { useNavigate } from "react-router-dom";

export default function Project({ projects, setActiveModal }) {
  const params = useParams();
  const projectId = params.projectId;

  const project = projects.filter((item) => {
    return item._id === projectId;
  })[0];

  const navigator = useNavigate()

  function openDiagramModal(){
    setActiveModal('diagram')
  }

  return (
    <>
    <div className="project">
      <div className="project__header">
        <p className="project__header-title"><img onClick={()=>{navigator(-1)}} src={backIcon} alt="go back" className="project__back-icon" />{project?.projectName.toUpperCase()}</p>
      </div>
      <div className="project__body">
        <div className="project__body-create-estimate-section">
          <button className="project__body-create-estimate-button create-button">Generate Estimate</button>
          <div className="project__body-horizontal-spacer"></div>
          <h2 className="project__body-diagram-header">Diagram</h2>
          <button onClick={openDiagramModal} className="project__body-create-diagram-button create-button">Create Diagram</button>
        </div>
      </div>
    </div>
    </>
  );
}
