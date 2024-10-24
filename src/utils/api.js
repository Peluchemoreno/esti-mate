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

export function getProducts(token){
  return fetch(BASE_URL + "dashboard/products", {
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

export function createProduct(productData, token){
  return fetch(BASE_URL + "dashboard/products", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify(productData)
  }).then(processServerResponse)
  .then(data => {
    return data
  })
}

export function updateProduct(productData, token){
  return fetch(BASE_URL + 'dashboard/products', {
    method: "PATCH",
    headers: {
      "Content-Type": 'application/json',
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify(productData)
  })
  .then(processServerResponse).then(data => {
    return data
  })
}

export function deleteProduct(productId, token){
  return fetch(BASE_URL + "dashboard/products", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify(productId)
  }).then(processServerResponse)
  .then(data => {
    return data
  })
}