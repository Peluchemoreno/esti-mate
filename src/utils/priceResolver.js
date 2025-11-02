// === priceResolver.js ===
//
// Helpers to resolve products/prices for gutters, accessories, and downspout fittings
// using strict profile + size + kind mapping. Never default to 5" K-Style
// unless the line actually specifies K-Style 5".

// ---------------- Normalizers ----------------
const norm = (s) =>
  String(s ?? "")
    .trim()
    .toLowerCase();

/**
 * Canonicalize line/canvas profile keys.
 * Lines use "half-round", but the catalog uses profile:"round" in products.
 */
export function normalizeProfileKey(p) {
  const s = norm(p);
  if (!s) return "custom";
  if (s.includes("half")) return "half-round"; // canonical for lines
  if (s.includes("straight")) return "straight-face";
  if (s.includes("k-") || s.includes("k style") || s.includes("kstyle"))
    return "k-style";
  if (s.includes("box")) return "box";
  if (s.includes("round")) return "half-round"; // treat generic "round" as half-round family on lines
  if (s.includes("custom")) return "custom";
  return s;
}

/** Map a line's canonical profile to how the catalog encodes it (half-round → round). */
function catalogProfileFor(profileKey) {
  const p = normalizeProfileKey(profileKey);
  if (p === "half-round") return "round";
  return p;
}

/** Normalize inches: 5 or "5" or 5" → '5"', 6 → '6"', etc. */
export function normalizeSizeInches(size) {
  const raw = String(size ?? "").replace(/\s/g, "");
  if (!raw) return null;
  const m = raw.match(/^(\d)"?$/);
  return m ? `${m[1]}"` : raw;
}

// --------------- Name token helpers ----------------
function nameContainsAll(str, tokens) {
  const s = norm(str);
  return tokens.every((t) => s.includes(norm(t)));
}

function kindTokens(kind) {
  const k = norm(kind);
  if (k.includes("strip")) return ["strip miter", "strip", "miter"];
  if (k.includes("bay")) return ["bay miter", "bay"];
  if (k.includes("custom miter")) return ["custom miter", "custom"];
  if (k.includes("end cap")) return ["end cap", "endcap", "cap"];
  return [k];
}

// Some catalog rows have imperfect profile fields; use product name as a fallback.
function profileFromName(name) {
  const s = norm(name);
  if (s.includes("straight face")) return "straight-face";
  if (s.includes("k-style") || s.includes("k style")) return "k-style";
  if (s.includes("half round")) return "half-round";
  if (s.startsWith("box ") || s.includes(" box ")) return "box";
  if (s.includes("custom")) return "custom";
  if (s.includes("round")) return "half-round";
  return null;
}

// Extract size like 5", 6", 7" from a product name.
function sizeFromName(name) {
  const s = norm(name);
  const m = s.match(/(^|\s)(\d\d?)\s*"/);
  return m ? `${m[2]}"` : null;
}

// Case-insensitive, "name includes all parts" matcher
function findByNameParts(products = [], parts = []) {
  const wants = parts.filter(Boolean).map((p) => String(p).toLowerCase());
  return (
    products.find((p) => {
      const name = String(p.name || "").toLowerCase();
      return wants.every((w) => name.includes(w));
    }) || null
  );
}

// ---------------- Accessory Scoring (strict by profile + size + kind) ----------------
function scoreAccessoryProduct(prod, want) {
  // prod: { name, type, profile, size }
  // want: { profileKey, sizeInches, kind }
  const name = String(prod.name || "");
  const pSize = normalizeSizeInches(prod.size);
  const wProfileCanonical = normalizeProfileKey(want.profileKey);
  const wProfileCatalog = catalogProfileFor(want.profileKey);
  const wSize = normalizeSizeInches(want.sizeInches);
  const tokens = kindTokens(want.kind);

  if (norm(prod.type) !== "accessory") return -Infinity;

  // Must match kind by name (catalog encodes kind in the product name)
  if (!nameContainsAll(name, tokens)) return -Infinity;

  // Primary: field profile must match (after mapping)
  let profileScore = 0;
  if (norm(prod.profile) === norm(wProfileCatalog)) profileScore = 5;

  // Fallback: infer profile from name (e.g., Straight Face entries with wrong profile field)
  const inferred = profileFromName(name);
  if (profileScore === 0 && inferred && inferred === wProfileCanonical) {
    profileScore = 4;
  }

  // Do not accept if name clearly indicates a different profile
  if (inferred && inferred !== wProfileCanonical) return -Infinity;

  // Size scoring (some profiles like Box omit size)
  let sizeScore = 0;
  if (wSize && pSize) {
    sizeScore = norm(pSize) === norm(wSize) ? 3 : -1; // mismatch penalty
  } else if (!pSize) {
    // Product has no size field – try to read from name
    const nameSize = sizeFromName(name);
    if (wSize && nameSize) {
      sizeScore = norm(nameSize) === norm(wSize) ? 2 : -1;
    } else {
      // relax size if missing on the product (keep profile strict)
      sizeScore = 1;
    }
  } else {
    // want has no size (already relaxed), product has one – accept lightly
    sizeScore = 1;
  }

  // Small bonus if the name explicitly says the (canonical) profile words
  let nameProfileBonus = 0;
  if (nameContainsAll(name, [wProfileCanonical.replace("-", " ")])) {
    nameProfileBonus = 1;
  }

  return profileScore + sizeScore + nameProfileBonus;
}

// ---------------- Public Accessory Finders ----------------

/**
 * Strictly find an accessory by { profileKey, sizeInches, kind }
 * kind ∈ "strip miter" | "bay miter" | "custom miter" | "end cap"
 * Never cross profiles; relax size only if the catalog item omits size.
 */
export function findGutterAccessoryTemplate(
  allProducts,
  { profileKey, sizeInches, kind }
) {
  const list = Array.isArray(allProducts) ? allProducts : [];

  // Custom gutters always map to "Custom ..." accessories
  const wantProfile = normalizeProfileKey(profileKey);
  const want = {
    profileKey: wantProfile,
    sizeInches: normalizeSizeInches(sizeInches),
    kind,
  };

  if (wantProfile === "custom") {
    const customFirst = list
      .filter(
        (p) => norm(p.type) === "accessory" && norm(p.profile) === "custom"
      )
      .sort(
        (a, b) =>
          scoreAccessoryProduct(b, want) - scoreAccessoryProduct(a, want)
      );
    if (customFirst.length) return customFirst[0];

    const byName = list.filter(
      (p) => norm(p.type) === "accessory" && norm(p.name).includes("custom")
    );
    return byName[0] || null;
  }

  // Pass 1: strict size + profile + kind
  let best = null,
    bestScore = -Infinity;
  for (const p of list) {
    const s = scoreAccessoryProduct(p, want);
    if (s > bestScore) {
      best = p;
      bestScore = s;
    }
  }
  if (best && bestScore > 0) return best;

  // Pass 2: relax size (same profile + kind)
  const relaxed = { ...want, sizeInches: null };
  best = null;
  bestScore = -Infinity;
  for (const p of list) {
    const s = scoreAccessoryProduct(p, relaxed);
    if (s > bestScore) {
      best = p;
      bestScore = s;
    }
  }
  return best && bestScore > 0 ? best : null;
}

export function findStripMiterProduct(allProducts, { profileKey, sizeInches }) {
  return findGutterAccessoryTemplate(allProducts, {
    profileKey,
    sizeInches,
    kind: "strip miter",
  });
}
export function findBayMiterProduct(allProducts, { profileKey, sizeInches }) {
  return findGutterAccessoryTemplate(allProducts, {
    profileKey,
    sizeInches,
    kind: "bay miter",
  });
}
export function findCustomMiterProduct(
  allProducts,
  { profileKey, sizeInches }
) {
  return findGutterAccessoryTemplate(allProducts, {
    profileKey,
    sizeInches,
    kind: "custom miter",
  });
}
export function findEndCapProduct(allProducts, { profileKey, sizeInches }) {
  return findGutterAccessoryTemplate(allProducts, {
    profileKey,
    sizeInches,
    kind: "end cap",
  });
}

// ---------------- Downspout parsing / fittings ----------------

/**
 * Parse a sequence like "aabba246" where:
 *  - letters a/b/c are elbow types (A/B/C)
 *  - digits are offset inches (single-digit; extend if you need multi-digit later)
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
      offsets.push(Number(ch));
      i += 1;
      continue;
    }
    i += 1; // ignore other chars
  }
  return { elbows, offsets };
}

/** Pretty label like "2x3 Corrugated", `3" Round`, or "Box". */
function prettyDsSizeLabel(raw = "") {
  const s = String(raw || "").trim();

  // rectangular 2x3 / 3x4 / 4x5
  const rect = s.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (rect) {
    const size = `${rect[1]}x${rect[2]}`;
    if (/corrugated/i.test(s)) return `${size} Corrugated`;
    if (/smooth/i.test(s)) return `${size} Smooth`;
    if (/box/i.test(s)) return "Box";
    return size;
  }

  // round 3" / 4"
  const round = s.match(/(\d+)\s*["”″]?/);
  if (round && /round/i.test(s)) return `${round[1]}" Round`;

  return s.replace(/\s+/g, " ").trim();
}

/** Infer DS profile + normalized size token from a canvas line. */
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
  // Fallback
  return (
    findByNameParts(products, [sizeLabel, `${letter}`, "elbow"]) ||
    findByNameParts(products, ["elbow"])
  );
}

function findOffsetProduct({ profile, sizeLabel, inches }, products = []) {
  const inchTxt = `${inches}"`;
  if (profile === "round")
    return findByNameParts(products, [sizeLabel, "round", inchTxt, "offset"]);
  if (profile === "corrugated")
    return findByNameParts(products, [
      sizeLabel,
      "corrugated",
      inchTxt,
      "offset",
    ]);
  if (profile === "smooth")
    return findByNameParts(products, [sizeLabel, "smooth", inchTxt, "offset"]);
  if (profile === "box")
    return findByNameParts(products, ["box", inchTxt, "offset"]);
  return findByNameParts(products, [inchTxt, "offset"]);
}

/**
 * Build elbow/offset line items from one downspout line.
 * Returns array of { name, quantity, price, product, meta }
 */
export function fittingsFromDownspoutLine(line, products = []) {
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

  // Offsets (group by inches)
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

// ---------------- Gutter accessory computation (NEW) ----------------

/** Robust inference of gutter profile + size from a line */
function inferGutterProfileAndSize(line = {}) {
  const profileRaw =
    line.profileKey ||
    line.profile ||
    line.currentProduct?.profile ||
    line.currentProduct?.name ||
    "";
  const sizeRaw =
    line.sizeInches ||
    line.currentProduct?.size ||
    line.currentProduct?.name ||
    "";

  let profileKey = normalizeProfileKey(profileRaw);

  // Size: prefer explicit sizeInches, then parse from product name
  let sizeInches = normalizeSizeInches(sizeRaw);
  if (!sizeInches) {
    const name = String(line.currentProduct?.name || "");
    const m = name.toLowerCase().match(/(^|\s)(\d\d?)\s*"/);
    if (m) sizeInches = `${m[2]}"`;
  }

  // Heuristic: if product name clearly indicates profile, trust that
  const name = String(line.currentProduct?.name || "");
  const inferred = profileFromName(name);
  if (inferred) profileKey = inferred;

  return { profileKey, sizeInches };
}

/** Bucket angles into strip/bay/custom */
function angleBucket(deg) {
  const d = Math.round(Number(deg));
  if (Number.isNaN(d)) return { type: "custom", degrees: null };
  // treat 88-92 as 90; 123-127 or 133-137 as bay (companies often call 125/135 both "bay")
  if (d >= 88 && d <= 92) return { type: "strip", degrees: 90 };
  if ((d >= 123 && d <= 127) || (d >= 133 && d <= 137))
    return { type: "bay", degrees: d };
  return { type: "custom", degrees: d };
}

/**
 * Compute accessories from lines:
 * - End caps per terminal
 * - Miters from corner angles (90 => strip, ~125/135 => bay, other => custom)
 * - Downspout fittings from elbowSequence
 *
 * Returns: Array<{name, quantity, price, product, meta}>
 */
export function computeAccessoriesFromLines(
  lines = [],
  products = [],
  opts = {}
) {
  const out = [];

  // tallies: keyed by profileKey|sizeInches
  const endCaps = new Map(); // key -> count
  const mitersStrip = new Map(); // key -> count
  const mitersBay = new Map(); // key -> count
  const mitersCustom = new Map(); // key -> Map<degrees, count>

  // 1) Walk lines: gutters contribute ends & corners; DS contributes fittings
  for (const line of Array.isArray(lines) ? lines : []) {
    if (line?.isDownspout) {
      // elbow/offset parts
      out.push(...fittingsFromDownspoutLine(line, products));
      continue;
    }

    // Identify gutter-ish lines (skip notes/free marks)
    const name = String(line?.currentProduct?.name || "");
    const isGutter =
      !!line?.isGutter || /gutter/i.test(name || "") || line?.runFeet > 0;
    if (!isGutter) continue;

    const { profileKey, sizeInches } = inferGutterProfileAndSize(line);
    const key = `${profileKey}|${normalizeSizeInches(sizeInches) || ""}`;

    // terminals
    const left = Number(
      line?.topology?.endCaps?.left || line?.endCaps?.left || 0
    );
    const right = Number(
      line?.topology?.endCaps?.right || line?.endCaps?.right || 0
    );
    const terminals = (left > 0 ? 1 : 0) + (right > 0 ? 1 : 0);
    if (terminals > 0) endCaps.set(key, (endCaps.get(key) || 0) + terminals);

    // corners/angles
    const angles = Array.isArray(line?.topology?.corners)
      ? line.topology.corners
      : Array.isArray(line?.angles)
      ? line.angles
      : [];

    angles.forEach((a) => {
      const b = angleBucket(a);
      if (b.type === "strip") {
        mitersStrip.set(key, (mitersStrip.get(key) || 0) + 1);
      } else if (b.type === "bay") {
        mitersBay.set(key, (mitersBay.get(key) || 0) + 1);
      } else {
        const inner = mitersCustom.get(key) || new Map();
        const k = String(b.degrees ?? "custom");
        inner.set(k, (inner.get(k) || 0) + 1);
        mitersCustom.set(key, inner);
      }
    });
  }

  // 2) Materialize priced items from tallies using strict resolvers

  // End caps
  for (const [key, qty] of endCaps.entries()) {
    const [profileKey, sizeInches] = key.split("|");
    const prod =
      findEndCapProduct(products, { profileKey, sizeInches }) ||
      findEndCapProduct(products, { profileKey, sizeInches: null });
    if (!prod) continue;
    out.push({
      name: prod.name,
      quantity: qty,
      price: Number(prod.price || 0),
      product: prod,
      meta: { kind: "endCap", profileKey, size: sizeInches || undefined },
    });
  }

  // Strip miters
  for (const [key, qty] of mitersStrip.entries()) {
    const [profileKey, sizeInches] = key.split("|");
    const prod =
      findStripMiterProduct(products, { profileKey, sizeInches }) ||
      findStripMiterProduct(products, { profileKey, sizeInches: null });
    if (!prod) continue;
    out.push({
      name: prod.name,
      quantity: qty,
      price: Number(prod.price || 0),
      product: prod,
      meta: {
        kind: "miter",
        miterType: "strip",
        profileKey,
        size: sizeInches || undefined,
      },
    });
  }

  // Bay miters
  for (const [key, qty] of mitersBay.entries()) {
    const [profileKey, sizeInches] = key.split("|");
    const prod =
      findBayMiterProduct(products, { profileKey, sizeInches }) ||
      findBayMiterProduct(products, { profileKey, sizeInches: null });
    if (!prod) continue;
    out.push({
      name: prod.name,
      quantity: qty,
      price: Number(prod.price || 0),
      product: prod,
      meta: {
        kind: "miter",
        miterType: "bay",
        degrees: 135,
        profileKey,
        size: sizeInches || undefined,
      },
    });
  }

  // Custom miters (separate row per angle so the PDF can show “Custom Miter (112°)” etc.)
  for (const [key, angleMap] of mitersCustom.entries()) {
    const [profileKey, sizeInches] = key.split("|");
    const prod =
      findCustomMiterProduct(products, { profileKey, sizeInches }) ||
      findCustomMiterProduct(products, { profileKey, sizeInches: null });
    if (!prod) continue;

    for (const [degStr, qty] of angleMap.entries()) {
      const degrees = degStr === "custom" ? undefined : Number(degStr);
      const nameOverride =
        degrees != null ? `Custom Miter (${degrees}°)` : prod.name;
      out.push({
        name: nameOverride,
        quantity: qty,
        price: Number(prod.price || 0),
        product: prod,
        meta: {
          kind: "miter",
          miterType: "custom",
          degrees,
          profileKey,
          size: sizeInches || undefined,
        },
      });
    }
  }

  return out;
}
