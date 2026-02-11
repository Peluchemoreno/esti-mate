// src/utils/computeContainRect.js

// Pure math: mimic CSS object-fit: contain inside a box.
// Returns rect in LOCAL box coordinates (CSS pixels).
export function computeContainRect(boxW, boxH, imgW, imgH) {
  const bw = Number(boxW) || 0;
  const bh = Number(boxH) || 0;
  const iw = Number(imgW) || 0;
  const ih = Number(imgH) || 0;

  if (bw <= 0 || bh <= 0 || iw <= 0 || ih <= 0) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }

  const imgAspect = iw / ih;
  const boxAspect = bw / bh;

  let width, height, left, top;

  if (imgAspect > boxAspect) {
    // image is wider: fit width, letterbox top/bottom
    width = bw;
    height = bw / imgAspect;
    left = 0;
    top = (bh - height) / 2;
  } else {
    // image is taller: fit height, letterbox left/right
    height = bh;
    width = bh * imgAspect;
    top = 0;
    left = (bw - width) / 2;
  }

  return { left, top, width, height };
}
