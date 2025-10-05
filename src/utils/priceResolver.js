// === priceResolver.js ===

// Helpers to compute accessories from diagram lines and resolve to catalog products
// Works with your current product names list and the requirements described.

/**
 * Parse a sequence like "aabba246" where:
 *  - letters a/b/c are elbow types
 *  - numbers are offset inches (single-digit offsets, e.g., "246" => [2,4,6])
 *
 * If you need multi-digit offsets later (e.g., "12"), switch this to collect
 * consecutive digits instead of per-char push.
 */
export function parseElbowSequence(seq = "") {
  const elbows = { A: 0, B: 0, C: 0 };
  const offsets = [];
  const s = String(seq).trim().toLowerCase();

  let i = 0;
  while (i < s.length) {
    const ch = s[i];

    if (/[abc]/.test(ch)) {
      elbows[ch.toUpperCase()] = (elbows[ch.toUpperCase()] || 0) + 1;
      i += 1;
      continue;
    }

    if (/\d/.test(ch)) {
      // treat each digit as its own offset inch (2,4,6)
      offsets.push(Number(ch));
      i += 1;
      continue;
    }

    // ignore anything else (quotes, spaces, punctuation)
    i += 1;
  }

  return { elbows, offsets };
}

// Pretty label for DS sizes like "2x3 corrugated" → "2x3 Corrugated"
function prettyDsSizeLabel(raw = "") {
  const s = String(raw || "").trim();
  const rect = s.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (rect) {
    const size = `${rect[1]}x${rect[2]}`;
    if (/corrugated/i.test(s)) return `${size} Corrugated`;
    if (/smooth/i.test(s)) return `${size} Smooth`;
    if (/box/i.test(s)) return "Box";
    return size;
  }
  // round like 3", 4"
  const round = s.match(/(\d+)\s*["”″]?/);
  if (round && /round/i.test(s)) {
    return `${round[1]}" Round`;
  }
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Infer DS profile + normalized size text for product matching from a line.
 */
function inferDownspoutProfileAndSize(line = {}) {
  const rawSize =
    line.downspoutSize ||
    line.size ||
    line.currentProduct?.size ||
    line.currentProduct?.name ||
    "";
  const rawProfile =
    line.downspoutProfile ||
    line.profile ||
    line.currentProduct?.profile ||
    line.currentProduct?.name ||
    "";

  const lowerName = `${line.currentProduct?.name || ""}`.toLowerCase();
  const lowerRawSize = String(rawSize || "").toLowerCase();
  const lowerProfile = String(rawProfile || "").toLowerCase();

  // Rectangular "2x3", "3x4", "4x5"
  const rect =
    lowerName.match(/(\d+)\s*[x×]\s*(\d+)/) ||
    lowerRawSize.match(/(\d+)\s*[x×]\s*(\d+)/);
  let sizeLabel = rect ? `${rect[1]}x${rect[2]}` : null;

  // Round "3" / "4" (with inches mark)
  if (!sizeLabel) {
    const roundM =
      lowerName.match(/(\d+)\s*["”″]/) || lowerRawSize.match(/(\d+)\s*["”″]/);
    if (roundM) sizeLabel = `${roundM[1]}"`;
  }

  // Box (e.g., "Box Downspout")
  if (!sizeLabel && /box/.test(lowerName + " " + lowerRawSize)) {
    sizeLabel = "box";
  }

  // Determine profile
  let profile = "corrugated";
  if (/round/.test(lowerName + " " + lowerProfile)) profile = "round";
  else if (/smooth/.test(lowerName + " " + lowerProfile)) profile = "smooth";
  else if (/box/.test(lowerName + " " + lowerProfile)) profile = "box";
  else if (/corrugated/.test(lowerName + " " + lowerProfile))
    profile = "corrugated";

  // Display label like "2x3 Corrugated", '3" Round', or "Box"
  let styleLabel = "Downspout";
  if (profile === "round" && sizeLabel) styleLabel = `${sizeLabel} Round`;
  else if (profile === "corrugated" && sizeLabel)
    styleLabel = `${sizeLabel} Corrugated`;
  else if (profile === "smooth" && sizeLabel)
    styleLabel = `${sizeLabel} Smooth`;
  else if (profile === "box") styleLabel = "Box";

  return { profile, sizeLabel, styleLabel };
}

// Case-insensitive "name includes all the parts" matcher
function findByNameParts(products = [], parts = []) {
  const wants = parts.filter(Boolean).map((p) => String(p).toLowerCase());
  return (
    products.find((p) => {
      const name = String(p.name || "").toLowerCase();
      return wants.every((w) => name.includes(w));
    }) || null
  );
}

// ---------- Downspout fittings: elbows & offsets ----------
function findElbowProduct({ profile, sizeLabel, letter }, products = []) {
  if (profile === "round") {
    // e.g. `3" Round Elbow`
    return findByNameParts(products, [sizeLabel, "round", "elbow"]);
  }
  if (profile === "corrugated") {
    // e.g. "3x4 Corrugated A Elbow"
    return findByNameParts(products, [
      sizeLabel,
      "corrugated",
      `${letter}`,
      "elbow",
    ]);
  }
  if (profile === "smooth") {
    // e.g. "3x4 Smooth A Elbow"
    return findByNameParts(products, [
      sizeLabel,
      "smooth",
      `${letter}`,
      "elbow",
    ]);
  }
  if (profile === "box") {
    // e.g. "Box A Elbow" / "Box B Elbow"
    return findByNameParts(products, ["box", `${letter}`, "elbow"]);
  }

  // Fallback generic
  return (
    findByNameParts(products, [sizeLabel, `${letter}`, "elbow"]) ||
    findByNameParts(products, ["elbow"])
  );
}

function findOffsetProduct({ profile, sizeLabel, inches }, products = []) {
  const inchTxt = `${inches}"`;

  if (profile === "round") {
    // e.g. 3" Round 2" Offset
    return findByNameParts(products, [sizeLabel, "round", inchTxt, "offset"]);
  }
  if (profile === "corrugated") {
    // e.g. 3x4 Corrugated 2" Offset
    return findByNameParts(products, [
      sizeLabel,
      "corrugated",
      inchTxt,
      "offset",
    ]);
  }
  if (profile === "smooth") {
    // Not in your catalog today; try anyway (harmless if not found)
    return findByNameParts(products, [sizeLabel, "smooth", inchTxt, "offset"]);
  }
  if (profile === "box") {
    // e.g. Box 2" Offset
    return findByNameParts(products, ["box", inchTxt, "offset"]);
  }

  // Fallback
  return findByNameParts(products, [inchTxt, "offset"]);
}

/**
 * Build elbow/offset items from one downspout line.
 * Returns items in the PDF-friendly shape:
 *   { name, quantity, price, product, meta }
 */
function fittingsFromDownspoutLine(line, products = [], opts = {}) {
  if (!line?.isDownspout) return [];
  const seq = String(line.elbowSequence || "");
  if (!seq.trim()) return [];

  const { elbows, offsets } = parseElbowSequence(seq);
  const { profile, sizeLabel, styleLabel } = inferDownspoutProfileAndSize(line);

  const out = [];

  // Elbows (A/B/C or generic for round)
  ["A", "B", "C"].forEach((letter) => {
    const qty = elbows[letter] || 0;
    if (!qty) return;
    const prod = findElbowProduct({ profile, sizeLabel, letter }, products);
    if (prod) {
      out.push({
        name:
          profile === "round"
            ? `${styleLabel} Elbow`
            : `${styleLabel} ${letter} Elbow`,
        quantity: qty,
        price: Number(prod.price || 0),
        product: prod,
        meta: { kind: "elbow", profile, sizeLabel, letter },
      });
    }
  });

  // Offsets (GROUP BY inches using parsed offsets!)
  const offsetMap = offsets.reduce((m, n) => {
    m[n] = (m[n] || 0) + 1;
    return m;
  }, {});
  Object.entries(offsetMap).forEach(([inchStr, qty]) => {
    const inches = Number(inchStr);
    if (!qty || Number.isNaN(inches)) return;

    const prod = findOffsetProduct({ profile, sizeLabel, inches }, products);
    if (prod) {
      out.push({
        name: `${styleLabel} ${inches}" Offset`,
        quantity: qty,
        price: Number(prod.price || 0),
        product: prod,
        meta: { kind: "offset", profile, sizeLabel, inches },
      });
    }
  });

  return out;
}

// ---------- Miters & End Caps (via optional tally) ----------
function profileLabelForName(profile) {
  if (!profile) return "";
  const p = String(profile).toLowerCase();
  if (p === "k-style" || p === "kstyle" || p === "k") return "K-Style";
  if (p === "straight-face" || p === "straightface") return "Straight Face";
  if (p === "half-round" || p === "halfround" || p === "round")
    return "Half Round";
  if (p === "box") return "Box";
  if (p === "custom") return "Custom";
  return profile; // fallback
}

function findMiterProduct({ profile, size, kind }, products = []) {
  const P = profileLabelForName(profile);
  const sizePart =
    size && !/custom/i.test(P) && !/box/i.test(P) ? String(size) : null;

  // Custom: any miter → "Custom Miter"
  if (/custom/i.test(P)) {
    return (
      findByNameParts(products, ["custom", "miter"]) ||
      findByNameParts(products, ["custom", kind, "miter"])
    );
  }

  if (/box/i.test(P)) {
    // Catalog has "6\" Box Miter" (no strip/bay split)
    return (
      findByNameParts(products, [String(size || ""), "box", "miter"]) ||
      findByNameParts(products, ["box", "miter"])
    );
  }

  if (
    /k-?style/i.test(P) ||
    /straight\s*face/i.test(P) ||
    /half\s*round/i.test(P)
  ) {
    // Strip vs Bay
    if (/strip/i.test(kind || "")) {
      return findByNameParts(products, [
        String(sizePart || ""),
        P,
        "strip",
        "miter",
      ]);
    }
    if (/bay/i.test(kind || "")) {
      return findByNameParts(products, [
        String(sizePart || ""),
        P,
        "bay",
        "miter",
      ]);
    }
    // fallback to strip if unknown kind
    return findByNameParts(products, [
      String(sizePart || ""),
      P,
      "strip",
      "miter",
    ]);
  }

  // Fallback
  return findByNameParts(products, ["miter"]);
}

function findEndCapProduct({ profile, size }, products = []) {
  const P = profileLabelForName(profile);

  if (/custom/i.test(P)) {
    return findByNameParts(products, ["custom", "end", "cap"]);
  }
  if (/box/i.test(P)) {
    return (
      findByNameParts(products, [String(size || ""), "box", "end", "cap"]) ||
      findByNameParts(products, ["box", "end", "cap"])
    );
  }
  if (
    /k-?style/i.test(P) ||
    /straight\s*face/i.test(P) ||
    /half\s*round/i.test(P)
  ) {
    return findByNameParts(products, [String(size || ""), P, "end", "cap"]);
  }
  return findByNameParts(products, ["end", "cap"]);
}

// ---------- Public API: computeAccessoriesFromLines ----------
/**
 * Build all accessory rows (elbows, offsets + optional miters & end caps).
 * Returns items ready for PDF table: { name, quantity, price, product, meta }
 *
 * @param {Array} lines diagram lines (each downspout line may include elbowSequence, downspoutSize, etc.)
 * @param {Array} products catalog (from /dashboard/products)
 * @param {Object} opts
 *    - miters: [{ profile, size, kind: 'strip'|'bay'|'custom', qty }]
 *    - endCaps: [{ profile, size, qty }]
 */
export function computeAccessoriesFromLines(
  lines = [],
  products = [],
  opts = {}
) {
  const out = [];

  // 1) Downspout fittings from each downspout line
  (lines || []).forEach((line) => {
    if (line?.isDownspout && line?.elbowSequence) {
      out.push(...fittingsFromDownspoutLine(line, products));
    }
  });

  // 2) Optional miters & end caps from tallies (so we don't change your UI)
  const miters = Array.isArray(opts.miters) ? opts.miters : [];
  const endCaps = Array.isArray(opts.endCaps) ? opts.endCaps : [];

  miters.forEach(({ profile, size, kind, qty }) => {
    const q = Number(qty || 0);
    if (!q) return;
    const prod = findMiterProduct({ profile, size, kind }, products);
    if (prod) {
      const label = /custom/i.test(profile || "")
        ? "Custom Miter"
        : /box/i.test(profile || "")
        ? `${String(size || "")} Box Miter`
        : `${String(size || "")} ${profileLabelForName(profile)} ${
            /bay/i.test(kind || "") ? "Bay Miter" : "Strip Miter"
          }`;

      out.push({
        name: label.trim().replace(/\s+/g, " "),
        quantity: q,
        price: Number(prod.price || 0),
        product: prod,
        meta: {
          kind: "miter",
          profile,
          size,
          class: /bay/i.test(kind || "") ? "bay" : "strip",
        },
      });
    }
  });

  endCaps.forEach(({ profile, size, qty }) => {
    const q = Number(qty || 0);
    if (!q) return;
    const prod = findEndCapProduct({ profile, size }, products);
    if (prod) {
      const label = /custom/i.test(profile || "")
        ? "Custom End Cap"
        : /box/i.test(profile || "")
        ? `${String(size || "")} Box End Cap`
        : `${String(size || "")} ${profileLabelForName(profile)} End Cap`;

      out.push({
        name: label.trim().replace(/\s+/g, " "),
        quantity: q,
        price: Number(prod.price || 0),
        product: prod,
        meta: { kind: "endcap", profile, size },
      });
    }
  });

  return out;
}
