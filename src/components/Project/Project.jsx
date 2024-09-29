import "./Project.css";
import { useParams } from "react-router-dom";

export default function Project({ projects }) {
  const params = useParams();
  const projectId = params.projectId;

  const project = projects.filter((item) => {
    return item._id === projectId;
  })[0];

  console.log(project)
  return (
    <>
      <div>this is project <span style={{
        color: 'red'
      }}>{project?.projectName}</span></div>
      <div>{project?.address}</div>
      <div>{project?.clientName}</div>
      <div>{project?.email}</div>
      <div>{project?.primaryPhoneNumber}</div>
      <div>{project?.secondaryPhoneNumber}</div>
    </>
  );
}
