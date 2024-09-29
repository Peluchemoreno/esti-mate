import { BASE_URL, processServerResponse } from "./constants";

export function signin(email, password){
  return fetch(BASE_URL + 'signin', {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({email, password})
  }).then(processServerResponse)
  .then(data => {
    localStorage.setItem('jwt', data.token)
    return data
  })
}

export function getUser(token){
  return fetch(BASE_URL + 'users/me', {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${token}`
    }
  })
  .then(processServerResponse)
  .then(user => {
    return user
  })
}

export function createProject(projectData, token){
  return fetch(BASE_URL + 'dashboard/projects', {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${token}`
    }, 
    body: JSON.stringify(projectData)
  }).then(processServerResponse)
  .then(data => {
    return data
  })
}

export function getProjects(token){
  return fetch(BASE_URL + 'dashboard/projects', {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${token}`
    }
  }).then(processServerResponse)
  .then(data => {
    return data
  })
}