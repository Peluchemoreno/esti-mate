export const users = [
  {
    email: "justin@email.com",
    password: "password123",
    firstName: "Justin",
    lastName: "One",
  },
  {
    email: "justin1@email.com",
    password: "password123",
    firstName: "Justin",
    lastName: "Two",
  },
  {
    email: "justin2@email.com",
    password: "password123",
    firstName: "Justin",
    lastName: "Three",
  },
  {
    email: "tyler.smith@fakeemail.com",
    password: "password123",
    firstName: "Tyler",
    lastName: "Smith",
  },
];
// when testing the app on the network and not on local host run the second baseUrl
export const BASE_URL = "http://127.0.0.1:4000/";
// export const BASE_URL = 'http://192.168.1.212:4000/'

export function processServerResponse(res) {
  if (res.ok) {
    return res.json();
  } else {
    return Promise.reject((error) => {
      console.error(error);
    });
  }
}

/* ------------------------------------------------------------------------------------ */
/*                                    grid utility functions                                    */
/* ------------------------------------------------------------------------------------ */

const topHorizontalLineCoords = { x1: 0, y1: 0, x2: 500, y2: 0 };
const leftVerticalLineCoords = { x1: 0, y1: 0, x2: 0, y2: 500 };

// coordinates of the start point of line 1 (x1_1, y1_1)
// coordinates of the end point of line 1 (x1_2, y1_2)

// coordinates of the start point of line 2 (x2_1, y2_1)
// coordinates of the end point of line 2 (x2_2, y2_2)

export function areLinesParallel(
  [x1_1, y1_1],
  [x1_2, y1_2],
  [x2_1, y2_1],
  [x2_2, y2_2]
) {
  if (isLineVertical(x1_1, x1_2) && isLineVertical(x2_1, x2_2)) {
    return true;
  }

  if (isLineHorizontal(y1_1, y1_2) && isLineHorizontal(y2_1, y2_2)) {
    return true;
  }

  const slope1 = (y1_2 - y1_1) / (x1_2 - x1_1);
  const slope2 = (y2_2 - y2_1) / (x2_2 - x2_1);
  return slope1 === slope2;
}

export function isLineParallelToTop(x1, y1, x2, y2) {
  const answer = areLinesParallel(
    [topHorizontalLineCoords.x1, topHorizontalLineCoords.y1],
    [topHorizontalLineCoords.x2, topHorizontalLineCoords.y2],
    [x1, y1],
    [x2, y2]
  );
  return answer;
}

export function isLineParallelToSide(x1, y1, x2, y2) {
  const answer = areLinesParallel(
    [leftVerticalLineCoords.x1, leftVerticalLineCoords.y1],
    [leftVerticalLineCoords.x2, leftVerticalLineCoords.y2],
    [x1, y1],
    [x2, y2]
  );
  return answer;
}

export function calculateDistance([x1, y1], [x2, y2]) {
  const solution = Math.round(Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2));
  return solution;
}

function isLineHorizontal(y1, y2) {
  return y1 === y2;
}

function isLineVertical(x1, x2) {
  return x1 === x2;
}

export function isLineNearPoint(x1, y1, x2, y2, px, py, radius) {
  function distance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }

  // Find the projection of (px, py) onto the line segment
  let A = px - x1;
  let B = py - y1;
  let C = x2 - x1;
  let D = y2 - y1;

  let dot = A * C + B * D;
  let lenSq = C * C + D * D;
  let param = lenSq !== 0 ? dot / lenSq : -1; // Avoid division by zero

  let closestX, closestY;

  if (param < 0) {
    closestX = x1;
    closestY = y1;
  } else if (param > 1) {
    closestX = x2;
    closestY = y2;
  } else {
    closestX = x1 + param * C;
    closestY = y1 + param * D;
  }

  // Check if the closest point on the line is within the given radius
  return distance(px, py, closestX, closestY) <= radius;
}
