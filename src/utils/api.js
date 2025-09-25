import { responsiveFontSizes } from "@mui/material";
import { BASE_URL, processServerResponse } from "./constants";

export function deleteProject(projectId, token) {
  return fetch(BASE_URL + `dashboard/projects/${projectId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  })
    .then(processServerResponse)
    .then((response) => {
      return response;
    });
}

export function deleteDiagram(projectId, diagramId, token) {
  return fetch(
    BASE_URL + `dashboard/projects/${projectId}/${diagramId}/delete`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  )
    .then(processServerResponse)
    .then((response) => {
      return response;
    });
}

export function addDiagramToProject(projectId, token, data) {
  return fetch(BASE_URL + `dashboard/projects/${projectId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  })
    .then(processServerResponse)
    .then((response) => {
      return response;
    });
}

export function updateDiagram(projectId, diagramId, token, data) {
  return fetch(BASE_URL + `dashboard/projects/${projectId}/${diagramId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  })
    .then(processServerResponse)
    .then((response) => {
      return response;
    });
}

export function retrieveProjectDiagrams(projectId, token) {
  return fetch(BASE_URL + `dashboard/projects/${projectId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  })
    .then(processServerResponse)
    .then((response) => {
      return response;
    });
}

export function createProject(projectData, token) {
  return fetch(BASE_URL + "dashboard/projects", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(projectData),
  })
    .then(processServerResponse)
    .then((data) => {
      return data;
    });
}

export function getProjects(token) {
  return fetch(BASE_URL + "dashboard/projects", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${token}`,
    },
  })
    .then(processServerResponse)
    .then((data) => {
      return data;
    });
}

export function getProducts(token, scope) {
  if (scope === "all") {
    return fetch(BASE_URL + "dashboard/products?scope=all", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${token}`,
      },
    })
      .then(processServerResponse)
      .then((data) => {
        return data;
      });
  } else {
    return fetch(BASE_URL + "dashboard/products", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${token}`,
      },
    })
      .then(processServerResponse)
      .then((data) => {
        return data;
      });
  }
}

export function createProduct(productData, token) {
  return fetch(BASE_URL + "dashboard/products", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(productData),
  })
    .then(processServerResponse)
    .then((data) => {
      return data;
    });
}

export function updateProduct(productData, token) {
  return fetch(BASE_URL + `dashboard/products/${productData.productId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(productData),
  })
    .then(processServerResponse)
    .then((data) => {
      // After product update succeeds:
      window.dispatchEvent(new Event("products-updated"));

      return data;
    });
}

export function deleteProduct(productId, token) {
  return fetch(BASE_URL + "dashboard/products", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(productId),
  })
    .then(processServerResponse)
    .then((data) => {
      return data;
    });
}
