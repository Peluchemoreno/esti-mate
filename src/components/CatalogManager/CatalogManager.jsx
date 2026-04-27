import { useEffect, useMemo, useState } from "react";
import {
  getCatalogItems,
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
} from "../../utils/api";

const MEASUREMENT_FAMILIES = ["line", "area", "count", "text", "custom"];
const DRAWING_TOOL_FAMILIES = ["line", "rect", "circle", "point", "text"];
const ESTIMATION_MODES = ["measured", "manual", "text"];
const SHAPE_OPTIONS = ["x", "circle", "arrow", "bent-arrow"];
const TRADE_OPTIONS = ["gutters", "fencing", "roofing", "siding", "general"];
const CATEGORY_OPTIONS = [
  "gutters",
  "downspouts",
  "guards",
  "accessories",
  "labor",
  "materials",
  "custom",
];
const CURRENCY_OPTIONS = ["usd"];

const UI_BEHAVIOR_OPTIONS = [
  "draw",
  "assembly",
  "derived",
  "pricing",
  "hidden",
];

const TOOL_GROUP_OPTIONS = [
  "gutters",
  "downspouts",
  "guards",
  "annotations",
  "general",
];

const ASSEMBLY_TYPE_OPTIONS = [
  "none",
  "gutter_run_v1",
  "downspout_v1",
  "custom",
];

const EMPTY_FORM = {
  name: "",
  description: "",
  isActive: true,

  trade: "gutters",
  category: "custom",
  measurementFamily: "count",
  drawingToolFamily: "point",

  pricing: {
    unitPrice: "0",
    unitLabel: "",
    currency: "usd",
  },

  drawingDefaults: {
    color: "#2f6fed",
    dashed: false,
    fill: false,
    fillColor: "#2f6fed",
    strokeWidth: "2",
    opacity: "1",
    radius: "",
    shape: "x",
  },

  ui: {
    group: "General",
    order: "100",
    visibleInQuickAdd: true,
    visibleInPricing: true,
    visibleInDiagram: true,
  },

  uiBehavior: "hidden",
  toolGroup: "general",

  assembly: {
    enabled: false,
    type: "none",
    configText: "{}",
  },

  behavior: {
    estimationMode: "measured",
    supportsDiagramPlacement: true,
    supportsFreeformPlacement: false,
    recommendedTool: "point",
  },
};

function toNumberOrDefault(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatOptionLabel(value) {
  if (!value) return "";
  return String(value)
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("-");
}

function safeParseJson(text, fallback = {}) {
  if (!text || !String(text).trim()) return fallback;

  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function buildCreatePayload(form) {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    isActive: !!form.isActive,
    trade: form.trade,
    category: form.category,
    measurementFamily: form.measurementFamily,
    drawingToolFamily: form.drawingToolFamily,

    pricing: {
      unitPrice: toNumberOrDefault(form.pricing.unitPrice, 0),
      unitLabel: form.pricing.unitLabel.trim(),
      currency: form.pricing.currency || "usd",
    },

    drawingDefaults: {
      color: form.drawingDefaults.color || "#000000",
      dashed: !!form.drawingDefaults.dashed,
      fill: !!form.drawingDefaults.fill,
      fillColor: form.drawingDefaults.fill
        ? form.drawingDefaults.fillColor || null
        : null,
      strokeWidth: toNumberOrDefault(form.drawingDefaults.strokeWidth, 2),
      opacity: toNumberOrDefault(form.drawingDefaults.opacity, 1),
      radius:
        form.drawingDefaults.radius === ""
          ? null
          : toNumberOrDefault(form.drawingDefaults.radius, null),
      shape:
        form.drawingToolFamily === "point"
          ? form.drawingDefaults.shape || null
          : null,
    },

    ui: {
      group: form.ui.group.trim() || "General",
      order: toNumberOrDefault(form.ui.order, 100),
      visibleInQuickAdd: !!form.ui.visibleInQuickAdd,
      visibleInPricing: !!form.ui.visibleInPricing,
      visibleInDiagram: !!form.ui.visibleInDiagram,
    },

    uiBehavior: form.uiBehavior || "hidden",
    toolGroup: form.toolGroup || "general",

    assembly: {
      enabled: !!form.assembly.enabled,
      type: form.assembly.enabled ? form.assembly.type || "custom" : "none",
      config: form.assembly.enabled
        ? safeParseJson(form.assembly.configText, {})
        : {},
    },

    behavior: {
      estimationMode: form.behavior.estimationMode,
      supportsDiagramPlacement: !!form.behavior.supportsDiagramPlacement,
      supportsFreeformPlacement: !!form.behavior.supportsFreeformPlacement,
      recommendedTool: form.behavior.recommendedTool || form.drawingToolFamily,
    },
  };
}

function buildUpdatePayload(form) {
  return buildCreatePayload(form);
}

function deriveFormFromItem(item) {
  return {
    name: item?.name || "",
    description: item?.description || "",
    isActive: item?.isActive ?? true,

    trade: item?.trade || "gutters",
    category: item?.category || "custom",
    measurementFamily: item?.measurementFamily || "count",
    drawingToolFamily: item?.drawingToolFamily || "point",

    pricing: {
      unitPrice: String(item?.pricing?.unitPrice ?? 0),
      unitLabel: item?.pricing?.unitLabel || "",
      currency: item?.pricing?.currency || "usd",
    },

    drawingDefaults: {
      color: item?.drawingDefaults?.color || "#000000",
      dashed: item?.drawingDefaults?.dashed ?? false,
      fill: item?.drawingDefaults?.fill ?? false,
      fillColor:
        item?.drawingDefaults?.fillColor ||
        item?.drawingDefaults?.color ||
        "#000000",
      strokeWidth: String(item?.drawingDefaults?.strokeWidth ?? 2),
      opacity: String(item?.drawingDefaults?.opacity ?? 1),
      radius:
        item?.drawingDefaults?.radius == null
          ? ""
          : String(item?.drawingDefaults?.radius),
      shape: item?.drawingDefaults?.shape || "x",
    },

    ui: {
      group: item?.ui?.group || "General",
      order: String(item?.ui?.order ?? 100),
      visibleInQuickAdd: item?.ui?.visibleInQuickAdd ?? true,
      visibleInPricing: item?.ui?.visibleInPricing ?? true,
      visibleInDiagram: item?.ui?.visibleInDiagram ?? true,
    },

    uiBehavior: item?.uiBehavior || "hidden",
    toolGroup: item?.toolGroup || "general",

    assembly: {
      enabled: item?.assembly?.enabled ?? false,
      type: item?.assembly?.type || "none",
      configText: JSON.stringify(item?.assembly?.config ?? {}, null, 2),
    },

    behavior: {
      estimationMode: item?.behavior?.estimationMode || "measured",
      supportsDiagramPlacement:
        item?.behavior?.supportsDiagramPlacement ?? true,
      supportsFreeformPlacement:
        item?.behavior?.supportsFreeformPlacement ?? false,
      recommendedTool:
        item?.behavior?.recommendedTool || item?.drawingToolFamily || "point",
    },
  };
}

function lineDashValue(isDashed) {
  return isDashed ? "8 6" : "";
}

function PreviewCard({ form }) {
  const color = form.drawingDefaults.color || "#2f6fed";
  const fillColor = form.drawingDefaults.fillColor || color;
  const strokeWidth = toNumberOrDefault(form.drawingDefaults.strokeWidth, 2);
  const opacity = toNumberOrDefault(form.drawingDefaults.opacity, 1);
  const radius = toNumberOrDefault(form.drawingDefaults.radius, 14);
  const dashed = !!form.drawingDefaults.dashed;
  const shape = form.drawingDefaults.shape || "x";
  const tool = form.drawingToolFamily;

  return (
    <div style={styles.previewCard}>
      <div style={styles.previewTitle}>Live Preview</div>

      <div style={styles.previewCanvas}>
        <svg width="100%" height="140" viewBox="0 0 260 140">
          {tool === "line" && (
            <line
              x1="30"
              y1="70"
              x2="230"
              y2="70"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={lineDashValue(dashed)}
              strokeLinecap="round"
              opacity={opacity}
            />
          )}

          {tool === "rect" && (
            <rect
              x="60"
              y="35"
              width="140"
              height="70"
              rx="8"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={lineDashValue(dashed)}
              fill={form.drawingDefaults.fill ? fillColor : "transparent"}
              fillOpacity={form.drawingDefaults.fill ? opacity * 0.25 : 0}
              opacity={opacity}
            />
          )}

          {tool === "circle" && (
            <circle
              cx="130"
              cy="70"
              r={Math.max(radius, 18)}
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={lineDashValue(dashed)}
              fill={form.drawingDefaults.fill ? fillColor : "transparent"}
              fillOpacity={form.drawingDefaults.fill ? opacity * 0.25 : 0}
              opacity={opacity}
            />
          )}

          {tool === "text" && (
            <text
              x="130"
              y="78"
              textAnchor="middle"
              fill={color}
              fontSize="20"
              fontWeight="700"
              opacity={opacity}
            >
              Text
            </text>
          )}

          {tool === "point" && shape === "x" && (
            <>
              <line
                x1="105"
                y1="45"
                x2="155"
                y2="95"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                opacity={opacity}
              />
              <line
                x1="155"
                y1="45"
                x2="105"
                y2="95"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                opacity={opacity}
              />
            </>
          )}

          {tool === "point" && shape === "circle" && (
            <circle
              cx="130"
              cy="70"
              r={Math.max(radius, 16)}
              stroke={color}
              strokeWidth={strokeWidth}
              fill={form.drawingDefaults.fill ? fillColor : "transparent"}
              fillOpacity={form.drawingDefaults.fill ? opacity * 0.25 : 0}
              opacity={opacity}
            />
          )}

          {tool === "point" && shape === "arrow" && (
            <>
              <line
                x1="60"
                y1="70"
                x2="170"
                y2="70"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                opacity={opacity}
              />
              <line
                x1="170"
                y1="70"
                x2="145"
                y2="52"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                opacity={opacity}
              />
              <line
                x1="170"
                y1="70"
                x2="145"
                y2="88"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                opacity={opacity}
              />
            </>
          )}

          {tool === "point" && shape === "bent-arrow" && (
            <>
              <line
                x1="75"
                y1="100"
                x2="75"
                y2="50"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                opacity={opacity}
              />
              <line
                x1="75"
                y1="50"
                x2="175"
                y2="50"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                opacity={opacity}
              />
              <line
                x1="175"
                y1="50"
                x2="150"
                y2="32"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                opacity={opacity}
              />
              <line
                x1="175"
                y1="50"
                x2="150"
                y2="68"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                opacity={opacity}
              />
            </>
          )}
        </svg>
      </div>

      <div style={styles.previewMeta}>
        <div>
          <strong>Name:</strong> {form.name || "Untitled item"}
        </div>
        <div>
          <strong>Trade:</strong> {formatOptionLabel(form.trade)}
        </div>
        <div>
          <strong>Category:</strong> {formatOptionLabel(form.category)}
        </div>
        <div>
          <strong>Measurement:</strong>{" "}
          {formatOptionLabel(form.measurementFamily)}
        </div>
        <div>
          <strong>Tool:</strong> {formatOptionLabel(form.drawingToolFamily)}
        </div>
        <div>
          <strong>UI Behavior:</strong> {formatOptionLabel(form.uiBehavior)}
        </div>
        <div>
          <strong>Tool Group:</strong> {formatOptionLabel(form.toolGroup)}
        </div>
        <div>
          <strong>Assembly:</strong>{" "}
          {form.assembly.enabled
            ? formatOptionLabel(form.assembly.type)
            : "Disabled"}
        </div>
        <div>
          <strong>Price:</strong> $
          {toNumberOrDefault(form.pricing.unitPrice, 0).toFixed(2)}
        </div>
      </div>
    </div>
  );
}

function CatalogModal({
  open,
  mode,
  form,
  setForm,
  onClose,
  onSubmit,
  isSaving,
  isMobile,
}) {
  const [previewOpen, setPreviewOpen] = useState(false);

  if (!open) return null;

  const isPointTool = form.drawingToolFamily === "point";
  const isCircleTool = form.drawingToolFamily === "circle";
  const showRadius = isPointTool || isCircleTool;
  const showAssemblyConfig = !!form.assembly.enabled;

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalShell}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>
            {mode === "edit" ? "Edit Catalog Item" : "Create Catalog Item"}
          </h3>

          <button type="button" onClick={onClose} style={styles.closeButton}>
            ✕
          </button>
        </div>

        <div
          style={{
            ...styles.modalBody,
            ...(isMobile ? styles.modalBodyMobile : {}),
          }}
        >
          <div style={styles.modalFormColumn}>
            <div style={styles.sectionCard}>
              <div style={styles.sectionTitle}>Basic</div>

              <div style={styles.formGrid}>
                <label style={styles.label}>
                  Name
                  <input
                    style={styles.input}
                    value={form.name}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder='5" K-Style'
                  />
                </label>

                <label style={styles.label}>
                  Description
                  <input
                    style={styles.input}
                    value={form.description}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Optional description"
                  />
                </label>

                <label style={styles.label}>
                  Trade
                  <select
                    style={styles.input}
                    value={form.trade}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, trade: e.target.value }))
                    }
                  >
                    {TRADE_OPTIONS.map((option) => (
                      <option
                        key={option}
                        value={option}
                        style={styles.selectOption}
                      >
                        {formatOptionLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={styles.label}>
                  Category
                  <select
                    style={styles.input}
                    value={form.category}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, category: e.target.value }))
                    }
                  >
                    {CATEGORY_OPTIONS.map((option) => (
                      <option
                        key={option}
                        value={option}
                        style={styles.selectOption}
                      >
                        {formatOptionLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={styles.label}>
                  Measurement Family
                  <select
                    style={styles.input}
                    value={form.measurementFamily}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        measurementFamily: e.target.value,
                      }))
                    }
                  >
                    {MEASUREMENT_FAMILIES.map((option) => (
                      <option
                        key={option}
                        value={option}
                        style={styles.selectOption}
                      >
                        {formatOptionLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={styles.label}>
                  Drawing Tool Family
                  <select
                    style={styles.input}
                    value={form.drawingToolFamily}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        drawingToolFamily: e.target.value,
                        behavior: {
                          ...prev.behavior,
                          recommendedTool: e.target.value,
                        },
                      }))
                    }
                  >
                    {DRAWING_TOOL_FAMILIES.map((option) => (
                      <option
                        key={option}
                        value={option}
                        style={styles.selectOption}
                      >
                        {formatOptionLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={styles.checkboxInline}>
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        isActive: e.target.checked,
                      }))
                    }
                  />
                  Active
                </label>
              </div>
            </div>

            <div style={styles.sectionCard}>
              <div style={styles.sectionTitle}>Pricing</div>

              <div style={styles.formGrid}>
                <label style={styles.label}>
                  Unit Price
                  <input
                    style={styles.input}
                    type="number"
                    step="0.01"
                    value={form.pricing.unitPrice}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        pricing: {
                          ...prev.pricing,
                          unitPrice: e.target.value,
                        },
                      }))
                    }
                    placeholder="0.00"
                  />
                </label>

                <label style={styles.label}>
                  Unit Label
                  <input
                    style={styles.input}
                    value={form.pricing.unitLabel}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        pricing: {
                          ...prev.pricing,
                          unitLabel: e.target.value,
                        },
                      }))
                    }
                    placeholder="ft, each, sq ft"
                  />
                </label>

                <label style={styles.label}>
                  Currency
                  <select
                    style={styles.input}
                    value={form.pricing.currency}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        pricing: {
                          ...prev.pricing,
                          currency: e.target.value,
                        },
                      }))
                    }
                  >
                    {CURRENCY_OPTIONS.map((option) => (
                      <option
                        key={option}
                        value={option}
                        style={styles.selectOption}
                      >
                        {formatOptionLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div style={styles.sectionCard}>
              <div style={styles.sectionTitle}>Drawing Defaults</div>

              <div style={styles.formGrid}>
                <label style={styles.label}>
                  Color
                  <input
                    style={styles.colorInput}
                    type="color"
                    value={form.drawingDefaults.color}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        drawingDefaults: {
                          ...prev.drawingDefaults,
                          color: e.target.value,
                        },
                      }))
                    }
                  />
                </label>

                <label style={styles.checkboxInline}>
                  <input
                    type="checkbox"
                    checked={form.drawingDefaults.dashed}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        drawingDefaults: {
                          ...prev.drawingDefaults,
                          dashed: e.target.checked,
                        },
                      }))
                    }
                  />
                  Dashed
                </label>

                <label style={styles.checkboxInline}>
                  <input
                    type="checkbox"
                    checked={form.drawingDefaults.fill}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        drawingDefaults: {
                          ...prev.drawingDefaults,
                          fill: e.target.checked,
                        },
                      }))
                    }
                  />
                  Fill
                </label>

                <label style={styles.label}>
                  Fill Color
                  <input
                    style={styles.colorInput}
                    type="color"
                    value={form.drawingDefaults.fillColor}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        drawingDefaults: {
                          ...prev.drawingDefaults,
                          fillColor: e.target.value,
                        },
                      }))
                    }
                  />
                </label>

                <label style={styles.label}>
                  Stroke Width
                  <input
                    style={styles.input}
                    type="number"
                    min="1"
                    step="1"
                    value={form.drawingDefaults.strokeWidth}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        drawingDefaults: {
                          ...prev.drawingDefaults,
                          strokeWidth: e.target.value,
                        },
                      }))
                    }
                  />
                </label>

                <label style={styles.label}>
                  Opacity
                  <input
                    style={styles.input}
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={form.drawingDefaults.opacity}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        drawingDefaults: {
                          ...prev.drawingDefaults,
                          opacity: e.target.value,
                        },
                      }))
                    }
                  />
                </label>

                {showRadius && (
                  <label style={styles.label}>
                    Radius
                    <input
                      style={styles.input}
                      type="number"
                      min="1"
                      step="1"
                      value={form.drawingDefaults.radius}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          drawingDefaults: {
                            ...prev.drawingDefaults,
                            radius: e.target.value,
                          },
                        }))
                      }
                      placeholder="Optional"
                    />
                  </label>
                )}

                {isPointTool && (
                  <label style={styles.label}>
                    Shape
                    <select
                      style={styles.input}
                      value={form.drawingDefaults.shape}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          drawingDefaults: {
                            ...prev.drawingDefaults,
                            shape: e.target.value,
                          },
                        }))
                      }
                    >
                      {SHAPE_OPTIONS.map((option) => (
                        <option
                          key={option}
                          value={option}
                          style={styles.selectOption}
                        >
                          {formatOptionLabel(option)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </div>

            <div style={styles.sectionCard}>
              <div style={styles.sectionTitle}>UI</div>

              <div style={styles.formGrid}>
                <label style={styles.label}>
                  Group
                  <input
                    style={styles.input}
                    value={form.ui.group}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        ui: {
                          ...prev.ui,
                          group: e.target.value,
                        },
                      }))
                    }
                    placeholder="General"
                  />
                </label>
                <label style={styles.label}>
                  Order
                  <input
                    style={styles.input}
                    type="number"
                    step="1"
                    value={form.ui.order}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        ui: {
                          ...prev.ui,
                          order: e.target.value,
                        },
                      }))
                    }
                  />
                </label>
                <label style={styles.label}>
                  UI Behavior
                  <select
                    style={styles.input}
                    value={form.uiBehavior}
                    onChange={(e) => {
                      const nextUiBehavior = e.target.value;

                      setForm((prev) => ({
                        ...prev,
                        uiBehavior: nextUiBehavior,
                      }));
                    }}
                  >
                    {UI_BEHAVIOR_OPTIONS.map((option) => (
                      <option
                        key={option}
                        value={option}
                        style={styles.selectOption}
                      >
                        {formatOptionLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>{" "}
                <label style={styles.label}>
                  Tool Group
                  <select
                    style={styles.input}
                    value={form.toolGroup}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        toolGroup: e.target.value,
                      }))
                    }
                  >
                    {TOOL_GROUP_OPTIONS.map((option) => (
                      <option
                        key={option}
                        value={option}
                        style={styles.selectOption}
                      >
                        {formatOptionLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={styles.checkboxInline}>
                  <input
                    type="checkbox"
                    checked={form.ui.visibleInQuickAdd}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        ui: {
                          ...prev.ui,
                          visibleInQuickAdd: e.target.checked,
                        },
                      }))
                    }
                  />
                  Visible in Quick Add
                </label>
                <label style={styles.checkboxInline}>
                  <input
                    type="checkbox"
                    checked={form.ui.visibleInPricing}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        ui: {
                          ...prev.ui,
                          visibleInPricing: e.target.checked,
                        },
                      }))
                    }
                  />
                  Visible in Pricing
                </label>
                <label style={styles.checkboxInline}>
                  <input
                    type="checkbox"
                    checked={form.ui.visibleInDiagram}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        ui: {
                          ...prev.ui,
                          visibleInDiagram: e.target.checked,
                        },
                      }))
                    }
                  />
                  Visible in Diagram
                </label>
              </div>
            </div>

            <div style={styles.sectionCard}>
              <div style={styles.sectionTitle}>Assembly</div>

              <div style={styles.formGrid}>
                <label style={styles.checkboxInline}>
                  <input
                    type="checkbox"
                    checked={form.assembly.enabled}
                    onChange={(e) => {
                      const enabled = e.target.checked;

                      setForm((prev) => ({
                        ...prev,

                        // Do NOT touch uiBehavior here.
                        // "draw" means it appears in the toolbar.
                        // assembly.enabled means it can derive extra items.
                        uiBehavior: prev.uiBehavior,

                        assembly: {
                          ...prev.assembly,
                          enabled,
                          type: enabled
                            ? prev.assembly?.type === "none"
                              ? "gutter_run_v1"
                              : prev.assembly?.type || "gutter_run_v1"
                            : "none",
                          config: prev.assembly?.config || {},
                        },
                      }));
                    }}
                  />
                  Assembly Enabled
                </label>

                <label style={styles.label}>
                  Assembly Type
                  <select
                    style={styles.input}
                    value={form.assembly.type}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        assembly: {
                          ...prev.assembly,
                          type: e.target.value,
                        },
                      }))
                    }
                    disabled={!form.assembly.enabled}
                  >
                    {ASSEMBLY_TYPE_OPTIONS.map((option) => (
                      <option
                        key={option}
                        value={option}
                        style={styles.selectOption}
                      >
                        {formatOptionLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>

                {showAssemblyConfig && (
                  <label style={{ ...styles.label, gridColumn: "1 / -1" }}>
                    Assembly Config JSON
                    <textarea
                      style={styles.textarea}
                      value={form.assembly.configText}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          assembly: {
                            ...prev.assembly,
                            configText: e.target.value,
                          },
                        }))
                      }
                      placeholder='{"derive":["endCaps","miters"]}'
                    />
                  </label>
                )}
              </div>
            </div>

            <div style={styles.sectionCard}>
              <div style={styles.sectionTitle}>Behavior</div>

              <div style={styles.formGrid}>
                <label style={styles.label}>
                  Estimation Mode
                  <select
                    style={styles.input}
                    value={form.behavior.estimationMode}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        behavior: {
                          ...prev.behavior,
                          estimationMode: e.target.value,
                        },
                      }))
                    }
                  >
                    {ESTIMATION_MODES.map((option) => (
                      <option
                        key={option}
                        value={option}
                        style={styles.selectOption}
                      >
                        {formatOptionLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={styles.label}>
                  Recommended Tool
                  <select
                    style={styles.input}
                    value={form.behavior.recommendedTool}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        behavior: {
                          ...prev.behavior,
                          recommendedTool: e.target.value,
                        },
                      }))
                    }
                  >
                    {DRAWING_TOOL_FAMILIES.map((option) => (
                      <option
                        key={option}
                        value={option}
                        style={styles.selectOption}
                      >
                        {formatOptionLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={styles.checkboxInline}>
                  <input
                    type="checkbox"
                    checked={form.behavior.supportsDiagramPlacement}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        behavior: {
                          ...prev.behavior,
                          supportsDiagramPlacement: e.target.checked,
                        },
                      }))
                    }
                  />
                  Supports Diagram Placement
                </label>

                <label style={styles.checkboxInline}>
                  <input
                    type="checkbox"
                    checked={form.behavior.supportsFreeformPlacement}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        behavior: {
                          ...prev.behavior,
                          supportsFreeformPlacement: e.target.checked,
                        },
                      }))
                    }
                  />
                  Supports Freeform Placement
                </label>
              </div>
            </div>
          </div>

          <div style={styles.modalPreviewColumn}>
            {isMobile ? (
              <button
                type="button"
                style={styles.previewFab}
                onClick={() => setPreviewOpen(true)}
              >
                👁 Preview
              </button>
            ) : (
              <PreviewCard form={form} />
            )}
          </div>
        </div>

        <div style={styles.modalFooter}>
          <button
            type="button"
            onClick={onClose}
            style={styles.secondaryButton}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSubmit}
            disabled={!form.name.trim() || isSaving}
            style={{
              ...styles.primaryButton,
              opacity: !form.name.trim() || isSaving ? 0.6 : 1,
            }}
          >
            {isSaving
              ? "Saving..."
              : mode === "edit"
                ? "Update Item"
                : "Create Item"}
          </button>
        </div>
      </div>

      {isMobile && previewOpen && (
        <div style={styles.previewDrawerOverlay}>
          <div style={styles.previewDrawer}>
            <div style={styles.previewDrawerHeader}>
              <span>Preview</span>
              <button
                style={styles.previewClose}
                onClick={() => setPreviewOpen(false)}
              >
                Close
              </button>
            </div>

            <PreviewCard form={form} />
          </div>
        </div>
      )}
    </div>
  );
}

function SourceBadge({ item }) {
  const isMigrated = !!item?.source?.collection;

  return (
    <span
      style={{
        ...styles.badge,
        ...(isMigrated ? styles.badgeMigrated : styles.badgeNative),
      }}
    >
      {isMigrated ? "Migrated" : "Native"}
    </span>
  );
}

export default function CatalogManager() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [tradeFilter, setTradeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [measurementFilter, setMeasurementFilter] = useState("all");
  const [toolFilter, setToolFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 750);

  async function loadCatalogItems() {
    const token = localStorage.getItem("jwt");
    if (!token) {
      setError("Missing JWT token");
      return;
    }

    setStatus("loading");
    setError("");

    try {
      const filters = {};

      if (tradeFilter !== "all") filters.trade = tradeFilter;
      if (categoryFilter !== "all") filters.category = categoryFilter;
      if (measurementFilter !== "all") {
        filters.measurementFamily = measurementFilter;
      }
      if (toolFilter !== "all") {
        filters.drawingToolFamily = toolFilter;
      }
      if (activeFilter === "active") filters.isActive = true;
      if (activeFilter === "inactive") filters.isActive = false;

      const result = await getCatalogItems(token, filters);
      const normalized = Array.isArray(result) ? result : [];
      setItems(normalized);
      setStatus("success");
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to load catalog items");
      setStatus("error");
    }
  }

  useEffect(() => {
    loadCatalogItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tradeFilter,
    categoryFilter,
    measurementFilter,
    toolFilter,
    activeFilter,
  ]);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= 750);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  function handleOpenCreate() {
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setModalMode("create");
    setModalOpen(true);
  }

  function handleOpenEdit(item) {
    setEditingItem(item);
    setForm(deriveFormFromItem(item));
    setModalMode("edit");
    setModalOpen(true);
  }

  function handleCloseModal() {
    setModalOpen(false);
    setEditingItem(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit() {
    const token = localStorage.getItem("jwt");
    if (!token) return;

    setIsSaving(true);
    setError("");

    try {
      if (form.assembly.enabled) {
        try {
          JSON.parse(form.assembly.configText || "{}");
        } catch {
          throw new Error("Assembly Config JSON is invalid.");
        }
      }

      if (modalMode === "edit" && editingItem?._id) {
        const payload = buildUpdatePayload(form);
        const updated = await updateCatalogItem(
          editingItem._id,
          payload,
          token,
        );

        setItems((prev) =>
          prev.map((item) => (item._id === editingItem._id ? updated : item)),
        );
      } else {
        const payload = buildCreatePayload(form);
        const created = await createCatalogItem(payload, token);
        setItems((prev) => [created, ...prev]);
      }

      // firing event to update products
      localStorage.setItem("catalogVersion", String(Date.now()));
      window.dispatchEvent(new Event("catalog:updated"));

      handleCloseModal();
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to save catalog item");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(item) {
    const token = localStorage.getItem("jwt");
    if (!token || !item?._id) return;

    const isMigrated = !!item?.source?.collection;
    if (isMigrated) return;

    const confirmed = window.confirm(`Delete "${item.name}"?`);
    if (!confirmed) return;

    try {
      await deleteCatalogItem(item._id, token);
      setItems((prev) => prev.filter((row) => row._id !== item._id));
      // firing event to refresh products
      localStorage.setItem("catalogVersion", String(Date.now()));
      window.dispatchEvent(new Event("catalog:updated"));
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to delete catalog item");
    }
  }

  const searchedItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return items;

    return items.filter((item) => {
      return (
        item?.name?.toLowerCase().includes(q) ||
        item?.trade?.toLowerCase().includes(q) ||
        item?.category?.toLowerCase().includes(q) ||
        item?.ui?.group?.toLowerCase().includes(q) ||
        String(item?.uiBehavior || "")
          .toLowerCase()
          .includes(q) ||
        String(item?.toolGroup || "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [items, searchTerm]);

  const groupedItems = useMemo(() => {
    const groups = {};

    for (const item of searchedItems) {
      const groupName = item?.ui?.group || "General";
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(item);
    }

    return Object.entries(groups)
      .map(([groupName, groupItems]) => ({
        groupName,
        items: groupItems,
      }))
      .sort((a, b) => a.groupName.localeCompare(b.groupName));
  }, [searchedItems]);

  return (
    <div style={styles.page}>
      <div style={styles.headerRow}>
        <div>
          <h2 style={styles.pageTitle}>Catalog Manager</h2>
          <p style={styles.pageSubtitle}>
            Manage generic business catalog items safely without touching the
            current estimator UI.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          style={styles.primaryButton}
        >
          + New Catalog Item
        </button>
      </div>

      <div style={styles.filterCard}>
        <div style={styles.filterGrid}>
          <input
            style={styles.input}
            type="text"
            placeholder="Search by name, trade, category, group..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <select
            style={styles.input}
            value={tradeFilter}
            onChange={(e) => setTradeFilter(e.target.value)}
          >
            <option value="all">All trades</option>
            {TRADE_OPTIONS.map((option) => (
              <option key={option} value={option} style={styles.selectOption}>
                {formatOptionLabel(option)}
              </option>
            ))}
          </select>

          <select
            style={styles.input}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All categories</option>
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option} value={option} style={styles.selectOption}>
                {formatOptionLabel(option)}
              </option>
            ))}
          </select>

          <select
            style={styles.input}
            value={measurementFilter}
            onChange={(e) => setMeasurementFilter(e.target.value)}
          >
            <option value="all">All measurement families</option>
            {MEASUREMENT_FAMILIES.map((option) => (
              <option key={option} value={option} style={styles.selectOption}>
                {formatOptionLabel(option)}
              </option>
            ))}
          </select>

          <select
            style={styles.input}
            value={toolFilter}
            onChange={(e) => setToolFilter(e.target.value)}
          >
            <option value="all">All drawing tools</option>
            {DRAWING_TOOL_FAMILIES.map((option) => (
              <option key={option} value={option} style={styles.selectOption}>
                {formatOptionLabel(option)}
              </option>
            ))}
          </select>

          <select
            style={styles.input}
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>

          <button
            type="button"
            onClick={loadCatalogItems}
            style={styles.secondaryButton}
          >
            Refresh
          </button>
        </div>
      </div>

      {status === "loading" && (
        <div style={styles.infoCard}>Loading catalog items...</div>
      )}

      {error ? <div style={styles.errorCard}>{error}</div> : null}

      {status !== "loading" && groupedItems.length === 0 ? (
        <div style={styles.infoCard}>No catalog items found.</div>
      ) : null}

      <div style={styles.groupsWrap}>
        {groupedItems.map((group) => (
          <div key={group.groupName} style={styles.groupCard}>
            <div style={styles.groupHeader}>
              <div style={styles.groupTitle}>{group.groupName}</div>
              <div style={styles.groupCount}>{group.items.length} items</div>
            </div>

            {isMobile ? (
              <div style={styles.mobileCardsWrap}>
                {group.items.map((item) => {
                  const color = item?.drawingDefaults?.color || "#000000";
                  const isMigrated = !!item?.source?.collection;

                  return (
                    <div key={item._id} style={styles.mobileCard}>
                      <div style={styles.mobileCardTop}>
                        <div style={styles.nameCell}>
                          <div style={styles.nameMain}>{item.name}</div>
                          <div style={styles.nameSub}>
                            <SourceBadge item={item} />
                          </div>
                        </div>

                        <div
                          style={{
                            ...styles.swatch,
                            backgroundColor: color,
                          }}
                          title={color}
                        />
                      </div>

                      <div style={styles.mobileInfoGrid}>
                        <div style={styles.mobileInfoRow}>
                          <span style={styles.mobileInfoLabel}>Type</span>
                          <span>{formatOptionLabel(item.category || "-")}</span>
                        </div>

                        <div style={styles.mobileInfoRow}>
                          <span style={styles.mobileInfoLabel}>
                            Measurement
                          </span>
                          <span>
                            {formatOptionLabel(item.measurementFamily)}
                          </span>
                        </div>

                        <div style={styles.mobileInfoRow}>
                          <span style={styles.mobileInfoLabel}>Tool</span>
                          <span>
                            {formatOptionLabel(item.drawingToolFamily)}
                          </span>
                        </div>

                        <div style={styles.mobileInfoRow}>
                          <span style={styles.mobileInfoLabel}>
                            UI Behavior
                          </span>
                          <span>
                            {formatOptionLabel(item.uiBehavior || "hidden")}
                          </span>
                        </div>

                        <div style={styles.mobileInfoRow}>
                          <span style={styles.mobileInfoLabel}>Tool Group</span>
                          <span>
                            {formatOptionLabel(item.toolGroup || "general")}
                          </span>
                        </div>

                        <div style={styles.mobileInfoRow}>
                          <span style={styles.mobileInfoLabel}>Assembly</span>
                          <span>
                            {item?.assembly?.enabled
                              ? formatOptionLabel(
                                  item?.assembly?.type || "custom",
                                )
                              : "Disabled"}
                          </span>
                        </div>

                        <div style={styles.mobileInfoRow}>
                          <span style={styles.mobileInfoLabel}>Price</span>
                          <span>
                            ${(item?.pricing?.unitPrice ?? 0).toFixed(2)}
                          </span>
                        </div>

                        <div style={styles.mobileInfoRow}>
                          <span style={styles.mobileInfoLabel}>Status</span>
                          <span>{item.isActive ? "Active" : "Inactive"}</span>
                        </div>
                      </div>

                      <div style={styles.mobileActionsRow}>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(item)}
                          style={styles.smallButton}
                        >
                          Edit
                        </button>

                        {!isMigrated && (
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            style={styles.smallDangerButton}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Name</th>
                      <th style={styles.th}>Type</th>
                      <th style={styles.th}>Measurement</th>
                      <th style={styles.th}>Tool</th>
                      <th style={styles.th}>UI Behavior</th>
                      <th style={styles.th}>Tool Group</th>
                      <th style={styles.th}>Assembly</th>
                      <th style={styles.th}>Price</th>
                      <th style={styles.th}>Visual</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {group.items.map((item) => {
                      const color = item?.drawingDefaults?.color || "#000000";
                      const isMigrated = !!item?.source?.collection;

                      return (
                        <tr key={item._id}>
                          <td style={styles.td}>
                            <div style={styles.nameCell}>
                              <div style={styles.nameMain}>{item.name}</div>
                              <div style={styles.nameSub}>
                                <SourceBadge item={item} />
                              </div>
                            </div>
                          </td>

                          <td style={styles.td}>
                            {formatOptionLabel(item.category || "-")}
                          </td>
                          <td style={styles.td}>
                            {formatOptionLabel(item.measurementFamily)}
                          </td>
                          <td style={styles.td}>
                            {formatOptionLabel(item.drawingToolFamily)}
                          </td>
                          <td style={styles.td}>
                            {formatOptionLabel(item.uiBehavior || "hidden")}
                          </td>
                          <td style={styles.td}>
                            {formatOptionLabel(item.toolGroup || "general")}
                          </td>
                          <td style={styles.td}>
                            {item?.assembly?.enabled
                              ? formatOptionLabel(
                                  item?.assembly?.type || "custom",
                                )
                              : "Disabled"}
                          </td>
                          <td style={styles.td}>
                            ${(item?.pricing?.unitPrice ?? 0).toFixed(2)}
                          </td>

                          <td style={styles.td}>
                            <div
                              style={{
                                ...styles.swatch,
                                backgroundColor: color,
                              }}
                              title={color}
                            />
                          </td>

                          <td style={styles.td}>
                            {item.isActive ? "Active" : "Inactive"}
                          </td>

                          <td style={styles.td}>
                            <div style={styles.actionsRow}>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(item)}
                                style={styles.smallButton}
                              >
                                Edit
                              </button>

                              {!isMigrated && (
                                <button
                                  type="button"
                                  onClick={() => handleDelete(item)}
                                  style={styles.smallDangerButton}
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>

      <CatalogModal
        open={modalOpen}
        mode={modalMode}
        form={form}
        setForm={setForm}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        isSaving={isSaving}
        isMobile={isMobile}
      />
    </div>
  );
}

const styles = {
  modalBodyMobile: {
    gridTemplateColumns: "1fr",
  },

  mobileCardsWrap: {
    display: "grid",
    gap: "12px",
    padding: "12px",
  },

  mobileCard: {
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: "12px",
    background: "rgba(255,255,255,.03)",
    padding: "12px",
    display: "grid",
    gap: "12px",
  },

  mobileCardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
  },

  mobileInfoGrid: {
    display: "grid",
    gap: "8px",
  },

  mobileInfoRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    fontSize: "14px",
    borderTop: "1px solid rgba(255,255,255,.05)",
    paddingTop: "8px",
  },

  mobileInfoLabel: {
    opacity: 0.72,
    fontWeight: 600,
  },

  mobileActionsRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },

  selectOption: {
    backgroundColor: "#111111",
    color: "var(--white)",
  },

  selectInput: {
    width: "100%",
    minHeight: "42px",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,.18)",
    background: "#111111",
    color: "var(--white)",
    padding: "10px 12px",
    boxSizing: "border-box",
    outline: "none",
  },

  page: {
    width: "100%",
    maxWidth: "100%",
    padding: "20px",
    boxSizing: "border-box",
    color: "var(--white)",
    overflowX: "hidden",
  },

  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    flexWrap: "wrap",
    marginBottom: "20px",
  },

  pageTitle: {
    margin: 0,
    fontSize: "28px",
    fontWeight: 800,
  },

  pageSubtitle: {
    margin: "8px 0 0 0",
    opacity: 0.78,
    maxWidth: "760px",
    lineHeight: 1.45,
  },

  filterCard: {
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: "14px",
    background: "rgba(255,255,255,.04)",
    padding: "16px",
    marginBottom: "18px",
  },

  filterGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
  },

  input: {
    width: "100%",
    minHeight: "42px",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,.18)",
    background: "rgba(255,255,255,.06)",
    color: "var(--white)",
    padding: "10px 12px",
    boxSizing: "border-box",
    outline: "none",
  },

  textarea: {
    width: "100%",
    minHeight: "120px",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,.18)",
    background: "rgba(255,255,255,.06)",
    color: "var(--white)",
    padding: "12px",
    boxSizing: "border-box",
    outline: "none",
    resize: "vertical",
    fontFamily: "monospace",
    fontSize: "13px",
  },

  colorInput: {
    width: "100%",
    minHeight: "42px",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,.18)",
    background: "rgba(255,255,255,.06)",
    color: "var(--white)",
    padding: "4px",
    boxSizing: "border-box",
    outline: "none",
  },

  primaryButton: {
    backgroundColor: "var(--blue-primary)",
    border: "none",
    padding: "12px 16px",
    color: "var(--white)",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    transition: "background-color .2s ease",
  },

  secondaryButton: {
    border: "1px solid rgba(255,255,255,.18)",
    backgroundColor: "transparent",
    color: "var(--white)",
    borderRadius: "8px",
    padding: "12px 16px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },

  smallButton: {
    border: "1px solid rgba(255,255,255,.18)",
    backgroundColor: "transparent",
    color: "var(--white)",
    borderRadius: "6px",
    padding: "8px 12px",
    fontSize: "12px",
    cursor: "pointer",
  },

  smallDangerButton: {
    border: "1px solid rgba(255, 96, 96, .35)",
    backgroundColor: "rgba(255, 96, 96, .08)",
    color: "#ff9797",
    borderRadius: "6px",
    padding: "8px 12px",
    fontSize: "12px",
    cursor: "pointer",
  },

  infoCard: {
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: "14px",
    background: "rgba(255,255,255,.04)",
    padding: "16px",
    marginBottom: "16px",
  },

  errorCard: {
    border: "1px solid rgba(255, 110, 110, .35)",
    borderRadius: "14px",
    background: "rgba(255, 110, 110, .08)",
    color: "#ffadad",
    padding: "16px",
    marginBottom: "16px",
  },

  groupsWrap: {
    display: "grid",
    gap: "16px",
  },

  groupCard: {
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: "14px",
    background: "rgba(255,255,255,.04)",
    overflow: "hidden",
    maxWidth: "100%",
  },

  groupHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    padding: "14px 16px",
    borderBottom: "1px solid rgba(255,255,255,.08)",
  },

  groupTitle: {
    fontSize: "16px",
    fontWeight: 800,
  },

  groupCount: {
    fontSize: "12px",
    opacity: 0.72,
  },

  tableWrap: {
    width: "100%",
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
  },

  th: {
    textAlign: "left",
    padding: "12px 16px",
    fontSize: "12px",
    textTransform: "uppercase",
    opacity: 0.68,
    whiteSpace: "nowrap",
  },

  td: {
    padding: "14px 16px",
    borderTop: "1px solid rgba(255,255,255,.06)",
    whiteSpace: "nowrap",
    verticalAlign: "middle",
  },

  nameCell: {
    display: "grid",
    gap: "6px",
  },

  nameMain: {
    fontWeight: 700,
  },

  nameSub: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },

  badge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "4px 8px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 700,
  },

  badgeNative: {
    background: "rgba(47,111,237,.16)",
    color: "#aecdff",
    border: "1px solid rgba(47,111,237,.35)",
  },

  badgeMigrated: {
    background: "rgba(255,255,255,.08)",
    color: "var(--white)",
    border: "1px solid rgba(255,255,255,.15)",
  },

  swatch: {
    width: "24px",
    height: "24px",
    borderRadius: "6px",
    border: "1px solid rgba(255,255,255,.15)",
  },

  actionsRow: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.72)",
    zIndex: 9999,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "20px",
    boxSizing: "border-box",
  },

  modalShell: {
    width: "min(1240px, 100%)",
    maxWidth: "100%",
    maxHeight: "92vh",
    overflow: "auto",
    borderRadius: "14px",
    border: "1px solid rgba(255,255,255,.12)",
    background: "#111111",
    color: "var(--white)",
    boxSizing: "border-box",
  },

  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    padding: "18px 20px",
    borderBottom: "1px solid rgba(255,255,255,.08)",
  },

  modalTitle: {
    margin: 0,
    fontSize: "22px",
    fontWeight: 800,
  },

  closeButton: {
    border: "none",
    background: "transparent",
    color: "var(--white)",
    fontSize: "20px",
    cursor: "pointer",
  },

  modalBody: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(320px, 420px)",
    gap: "20px",
    padding: "20px",
    alignItems: "start",
  },

  modalFormColumn: {
    minWidth: 0,
    display: "grid",
    gap: "16px",
  },

  modalPreviewColumn: {
    minWidth: 0,
    position: "sticky",
    top: "20px",
    alignSelf: "start",
  },
  sectionCard: {
    border: "1px solid rgba(255,255,255,.10)",
    borderRadius: "12px",
    background: "rgba(255,255,255,.03)",
    padding: "16px",
  },

  sectionTitle: {
    fontSize: "16px",
    fontWeight: 800,
    marginBottom: "14px",
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "14px",
  },

  label: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    fontSize: "14px",
    fontWeight: 600,
  },

  checkboxInline: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minHeight: "42px",
    fontSize: "14px",
    fontWeight: 600,
  },

  modalFooter: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
    padding: "18px 20px",
    borderTop: "1px solid rgba(255,255,255,.08)",
  },

  previewCard: {
    border: "1px solid rgba(255,255,255,.10)",
    borderRadius: "12px",
    background: "rgba(255,255,255,.03)",
    padding: "16px",
  },

  previewTitle: {
    fontSize: "18px",
    fontWeight: 800,
    marginBottom: "12px",
  },

  previewCanvas: {
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: "10px",
    background: "rgba(255,255,255,.02)",
    padding: "12px",
    marginBottom: "12px",
  },

  previewMeta: {
    display: "grid",
    gap: "8px",
    fontSize: "14px",
    lineHeight: 1.4,
  },

  previewFab: {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    borderRadius: "999px",
    padding: "12px 18px",
    background: "#2f6fed",
    color: "white",
    border: "none",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 8px 20px rgba(0,0,0,.35)",
    zIndex: 30,
  },

  previewDrawerOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.55)",
    display: "flex",
    alignItems: "flex-end",
    zIndex: 40,
  },

  previewDrawer: {
    width: "100%",
    background: "#111",
    borderTopLeftRadius: "16px",
    borderTopRightRadius: "16px",
    padding: "16px",
    maxHeight: "70vh",
    overflow: "auto",
  },

  previewDrawerHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
    fontWeight: 700,
  },

  previewClose: {
    background: "transparent",
    border: "none",
    color: "white",
    cursor: "pointer",
  },
};
