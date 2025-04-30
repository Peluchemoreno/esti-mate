import { BASE_URL, processServerResponse } from "./constants";

export function signin(email, password) {
  return fetch(BASE_URL + "signin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  })
    .then(processServerResponse)
    .then((data) => {
      localStorage.setItem("jwt", data.token);
      return data;
    });
}

export function signUp(userData) {
  return fetch(BASE_URL + "users/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(userData),
  })
    .then(processServerResponse)
    .then((data) => {
      return data;
    });
}

// export function uploadLogo(formData, token) {
//   return fetch(BASE_URL + "upload-logo", {
//     method: "POST",
//     headers: {
//       authorization: `Bearer ${token}`,
//     },
//     body: formData,
//   })
//     .then(processServerResponse)
//     .then((data) => {
//       return data;
//     });
// }
export function uploadLogo(logo, token) {
  const formData = new FormData();
  formData.append("logo", logo); // 'logo' must match field name in multer

  return fetch(BASE_URL + "users/upload-logo", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      // DO NOT add 'Content-Type'
    },
    body: formData,
  })
    .then(processServerResponse)
    .then((data) => {
      return data;
    });
}



export async function getCompanyLogo(userId, token) {
  const res = await fetch(`${BASE_URL}users/${userId}/logo`, {
    headers: {
      Authorization: `Bearer ${token}`, // ✅ no Content-Type header
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch company logo");
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob); // ✅ convert blob to browser-usable image URL
}


export function getUser(token) {
  return fetch(BASE_URL + "users/me", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${token}`,
    },
  })
    .then(processServerResponse)
    .then((user) => {
      return user;
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

export function updateUserInfo(userInfo, token) {
  return fetch(BASE_URL + "users/me", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(userInfo),
  })
    .then(processServerResponse)
    .then((data) => {
      return data;
    });
}
