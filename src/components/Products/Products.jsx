// src/components/Products/Products.jsx
import "./Products.css";
import { DataGrid, gridNumberComparator } from "@mui/x-data-grid";
import { Box } from "@mui/material/";
import { useEffect, useMemo, useState } from "react";
import AddProductModal from "../AddProductModal/AddProductModal";
import EditProductModal from "../EditProductModal/EditProductModal";
import { createProduct } from "../../utils/api";
import { useProductsCatalog } from "../../contexts/ProductsContext";
import { useProductsListed } from "../../hooks/useProducts";
import { useQueryClient } from "@tanstack/react-query";

export default function Products({ activeModal, setActiveModal, closeModal }) {
  const { refresh } = useProductsCatalog();
  const { data: products = [], isLoading, error } = useProductsListed();
  const [tableRows, setTableRows] = useState([]);
  const [currentItem, setCurrentItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();

  const isGutter = (p) => p?.type === "gutter";

  // prefers a saved user color, falls back to template defaults some UIs use
  const resolveColor = (p) =>
    p?.color || p?.colorCode || p?.defaultColor || p?.visual || null;

  // Deduplicate defensively by _id (guards against double fetches/StrictMode)
  const uniqueRows = useMemo(() => {
    const m = new Map();
    for (const r of tableRows) {
      if (r && r._id) m.set(r._id, r);
    }
    return Array.from(m.values());
  }, [tableRows]);

  // Filter by search
  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return uniqueRows;
    return uniqueRows.filter((row) => row.name?.toLowerCase().includes(q));
  }, [uniqueRows, searchTerm]);

  // Columns
  const columns = useMemo(
    () => [
      {
        field: "name",
        headerName: "Name",
        width: 250,
        headerClassName: "products__column-header",
        renderCell: (params) => (
          <Box
            onClick={() => handleEditItemClick(params.row)}
            sx={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
            }}
          >
            <div className="cell-data">{params.value}</div>
          </Box>
        ),
      },
      {
        field: "visual",
        headerName: "Visual",
        width: 150,
        headerClassName: "products__column-header",
        renderCell: (params) => {
          const type = String(params.row?.type || "").toLowerCase();
          const isGutter = type === "gutter";
          const isDownspout = type === "downspout";
          // prefer saved color, then template/defaults
          const color =
            params.row?.color ??
            params.row?.colorCode ??
            params.row?.visual ??
            params.row?.defaultColor ??
            null;

          const showSwatch = (isGutter || isDownspout) && !!color;

          return (
            <Box
              sx={{
                width: "100%",
                height: "100%",
                backgroundColor: showSwatch ? color : "transparent",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                paddingLeft: 1,
              }}
              title={showSwatch ? color : ""}
            >
              <div>{showSwatch ? color : "-"}</div>
            </Box>
          );
        },
      },
      {
        field: "quantity",
        headerName: "Quantity",
        width: 150,
        headerClassName: "products__column-header",
        renderCell: (params) => (
          <Box
            sx={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              paddingLeft: 1,
            }}
          >
            <div>{params.row?.unit === "foot" ? "per/foot" : "per/unit"}</div>
          </Box>
        ),
      },
      {
        field: "price",
        headerName: "Price",
        width: 150,
        headerClassName: "products__column-header",
        renderCell: (params) => {
          const n = Number(params.row?.price);
          const val = Number.isFinite(n) ? n : 0;
          return (
            <Box
              sx={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                paddingLeft: 1,
              }}
            >
              <div>${val.toFixed(2)}</div>
            </Box>
          );
        },
      },
    ],
    []
  );

  // Fetch once (and when modal closes after create/edit)
  useEffect(() => {
    const list = Array.isArray(products) ? products : [];
    setTableRows(list);
  }, [products, activeModal]);

  function handleAddItemClick() {
    setActiveModal("add-item");
  }

  function handleEditItemClick(item) {
    setCurrentItem(item);
    setActiveModal("edit item");
  }

  function handleCreateItemSubmit(itemData) {
    const token = localStorage.getItem("jwt");
    // IMPORTANT: send a NUMBER for price (backend casts Number)
    const payload = {
      name: itemData.itemName,
      visual: itemData.itemVisualColor,
      quantity: itemData.quantityUnit,
      price: Number(itemData.itemPrice), // no "$"
    };
    createProduct(payload, token).then((res) => {
      if (res?.data) {
        // Prepend new row and let dedupe take care of repeats
        setTableRows((prev) => [res.data, ...prev]);
        queryClient.invalidateQueries({ queryKey: ["products", "listed"] });
        closeModal();
      }
    });
  }

  return (
    <>
      <div className="products">
        <div className="products__header">
          <h3 className="products__header-title">Products</h3>
          {/* <button className="products__create-item-button" onClick={handleAddItemClick}>
            + Item
          </button> */}
        </div>

        <Box sx={{ padding: 2.5, width: "100%" }}>
          <div style={{ marginBottom: "1rem" }}>
            <input
              type="text"
              placeholder="Search products..."
              className="products__search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                fontSize: "14px",
                borderRadius: "4px",
                border: "1px solid #ccc",
                color: "var(--white)",
              }}
            />
          </div>

          <DataGrid
            rows={filteredRows}
            columns={columns}
            getRowId={(row) => row._id}
            sx={{ color: "white" }}
            autoHeight
            disableRowSelectionOnClick
          />
        </Box>
      </div>

      <AddProductModal
        activeModal={activeModal}
        closeModal={closeModal}
        submitItem={handleCreateItemSubmit}
      />

      <EditProductModal
        activeModal={activeModal}
        closeModal={closeModal}
        product={currentItem}
        refresh={refresh}
      />
    </>
  );
}
