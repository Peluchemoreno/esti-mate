import "./ProjectRowData.css";
import { Link } from "react-router-dom";
import CurrentUserContext from "../../contexts/CurrentUserContext/CurrentUserContext";
import { useContext } from "react";

export default function ProjectRowData({project, created}) {

  const currentUser = useContext(CurrentUserContext)
  

  return (
    <tr className="project__table-row">
      <td>
        <label className="project__select-checkbox checkbox">
          <input type="checkbox" name="select-project" id="selectProject" />
        </label>
        <span><Link className="project__link" to={`${project._id}`}>{project.projectName}</Link></span>
      </td>
      <td className="project__table-owner-column">{currentUser.name}</td>
      <td className="project__table-created-column">{created}</td>
    </tr>
  );
}
