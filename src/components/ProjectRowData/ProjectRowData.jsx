import "./ProjectRowData.css";

export default function ProjectRowData({projectName, owner, created}) {
  return (
    <tr className="project__table-row">
      <td>
        <label className="project__select-checkbox checkbox">
          <input type="checkbox" name="select-project" id="selectProject" />
        </label>
        <span>{projectName}</span>
      </td>
      <td className="project__table-owner-column">{owner}</td>
      <td className="project__table-created-column">{created}</td>
    </tr>
  );
}
