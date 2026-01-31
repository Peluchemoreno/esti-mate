import { responsiveFontSizes } from "@mui/material";
import { processServerResponse } from "./constants";
const BASE_URL = import.meta.env.VITE_API_URL;

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

export async function getProducts(token, scope /* "pricing" | undefined */) {
  const url =
    scope === "pricing"
      ? `${BASE_URL}dashboard/products?scope=pricing`
      : `${BASE_URL}dashboard/products?scope=ui`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    credentials: "include",
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`GET ${url} failed: ${res.status} ${txt}`);
  }

  // Your server returns an array already; normalize either way.
  const data = await res.json();
  return Array.isArray(data) ? data : data?.products ?? [];
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
  }).then(processServerResponse);
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
// ✅ Helper: normalize base once for new endpoints
function normBase(base) {
  if (!base) return "";
  return base.endsWith("/") ? base : `${base}/`;
}

// GET /dashboard/projects/:projectId/photos
export function getProjectPhotos(projectId, token) {
  const base = normBase(BASE_URL);
  return fetch(`${base}dashboard/projects/${projectId}/photos`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }).then(processServerResponse);
}

// src/utils/api.js

// POST /dashboard/projects/:projectId/photos/bulk  (multipart)
// field name: "photos" (up to 10)
export function uploadProjectPhotosBulk(projectId, token, files) {
  const base = normBase(BASE_URL);
  const fd = new FormData();

  const arr = Array.isArray(files) ? files : [];
  arr.forEach((f) => fd.append("photos", f));

  return fetch(`${base}dashboard/projects/${projectId}/photos/bulk`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      // ❗ DON'T set Content-Type manually for FormData
    },
    body: fd,
  }).then(processServerResponse);
}

// POST /dashboard/projects/:projectId/photos  (multipart)
export function uploadProjectPhoto(projectId, token, file) {
  const base = normBase(BASE_URL);
  const fd = new FormData();
  fd.append("photo", file);

  return fetch(`${base}dashboard/projects/${projectId}/photos`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      // ❗ DON'T set Content-Type manually for FormData
    },
    body: fd,
  }).then(processServerResponse);
}

// Helper: build the image URL (used by UI later)
export function projectPhotoImageUrl(projectId, photoId, variant = "preview") {
  const base = normBase(BASE_URL);
  return `${base}dashboard/projects/${projectId}/photos/${photoId}/image?variant=${variant}`;
}

// --------------------
// Project Photos (NEW)
// --------------------

export function deleteProjectPhoto(projectId, photoId, token) {
  return fetch(BASE_URL + `dashboard/projects/${projectId}/photos/${photoId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
    .then(processServerResponse)
    .then((res) => res);
}

// Fetch image bytes with auth (for thumbnails / PDF preloading)
export function fetchProjectPhotoBlob(
  projectId,
  photoId,
  token,
  variant = "preview"
) {
  return fetch(
    BASE_URL +
      `dashboard/projects/${projectId}/photos/${photoId}/image?variant=${variant}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  ).then(async (res) => {
    if (!res.ok) throw new Error(`photo fetch failed: ${res.status}`);
    return res.blob();
  });
}
