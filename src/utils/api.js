import { BASE_URL, processServerResponse } from "./constants";

export function deleteProject(projectId, token){
  return fetch(BASE_URL + `dashboard/projects/${projectId}`, {
    method: "DELETE",
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }).then(processServerResponse)
  .then(response => {
    return response
  })
}