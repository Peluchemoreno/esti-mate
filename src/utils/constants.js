export const users = [
  {
    email: 'justin@email.com',
    password: 'password123',
    firstName: "Justin",
    lastName: "One"
  },
  {
    email: 'justin1@email.com',
    password: 'password123',
    firstName: "Justin",
    lastName: "Two"
  },
  {
    email: 'justin2@email.com',
    password: 'password123',
    firstName: "Justin",
    lastName: "Three"
  }, 
  {
    email: 'tyler.smith@fakeemail.com',
    password: 'password123',
    firstName: 'Tyler',
    lastName: 'Smith'
  }
]
// when testing the app on the network and not on local host run the second baseUrl
// export const BASE_URL = 'http://127.0.0.1:4000/'
export const BASE_URL = 'http://192.168.1.212:4000/'

export function processServerResponse(res) {
  if (res.ok) {
    return res.json();
  } else {
    return Promise.reject((error) => {
      console.error(error);
    });
  }
}
