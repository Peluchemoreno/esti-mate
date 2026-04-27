function looksLikeLegacyDrawable(item) {
  const name = String(item?.name || "").toLowerCase();
  const type = String(item?.type || item?.category || "").toLowerCase();
  const drawingToolFamily = String(item?.drawingToolFamily || "").toLowerCase();

  if (drawingToolFamily) return true;
  if (type === "gutter") return true;
  if (name.includes("gutter")) return true;

  return false;
}

export function isCatalogItemDrawable(item) {
  if (!item) return false;

  const uiBehavior = String(item?.uiBehavior || "").toLowerCase();
  const visibleInDiagram = item?.ui?.visibleInDiagram ?? true;

  if (!visibleInDiagram) return false;

  // new system rules
  if (uiBehavior === "draw") return true;
  if (uiBehavior === "assembly") return false;
  if (uiBehavior === "derived") return false;
  if (uiBehavior === "pricing") return false;
  if (uiBehavior === "hidden") return false;

  // temporary bridge for old data

  return looksLikeLegacyDrawable(item);
}

function inferUiBehavior(item) {
  const explicit = String(item?.uiBehavior || "").toLowerCase();
  if (explicit) return explicit;

  const name = String(item?.name || "").toLowerCase();
  const type = String(item?.type || item?.category || "").toLowerCase();
  const drawingToolFamily = String(item?.drawingToolFamily || "").toLowerCase();

  // legacy gutter-era drawables
  if (drawingToolFamily) return "draw";
  if (type === "gutter") return "draw";
  if (name.includes("gutter")) return "draw";

  // legacy gutter-era derived/pricing-ish things
  if (name.includes("elbow")) return "derived";
  if (name.includes("offset")) return "derived";
  if (name.includes("miter")) return "derived";
  if (name.includes("end cap")) return "derived";
  if (name.includes("endcap")) return "derived";

  return "hidden";
}

function inferToolGroup(item) {
  const explicit = String(item?.toolGroup || "").toLowerCase();
  if (explicit) return explicit;

  const name = String(item?.name || "").toLowerCase();
  const type = String(item?.type || item?.category || "").toLowerCase();

  if (name.includes("downspout")) return "downspouts";
  if (name.includes("gutter") || type === "gutter") return "gutters";
  if (name.includes("guard")) return "guards";

  return "general";
}

export function catalogItemToTool(item) {
  return {
    id: item._id || item.id,
    value: item.name,
    label: item.name,

    toolGroup: inferToolGroup(item),
    uiBehavior: inferUiBehavior(item),

    drawingToolFamily: item?.drawingToolFamily || "line",
    measurementFamily: item?.measurementFamily || "line",

    color:
      item?.drawingDefaults?.color ||
      item?.visual ||
      item?.colorCode ||
      item?.color ||
      "#000",

    assembly: item?.assembly || { enabled: false, type: "none" },

    raw: item,
  };
}

export function groupCatalogTools(items = []) {
  const grouped = {};

  items.forEach((item) => {
    const group = item.toolGroup || "general";
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(item);
  });

  return Object.entries(grouped).map(([groupName, tools]) => ({
    groupName,
    tools,
  }));
}
