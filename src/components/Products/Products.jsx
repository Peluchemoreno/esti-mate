import "./Products.css";
import { DataGrid, gridClasses, GridToolbar } from "@mui/x-data-grid";
import { Box } from "@mui/material/";
import { useEffect, useState } from "react";
import AddProductModal from "../AddProductModal/AddProductModal";
import { getProducts, createProduct } from "../../utils/api";
import EditProductModal from "../EditProductModal/EditProductModal";

export default function Products({ activeModal, setActiveModal, closeModal }) {
  const [tableRows, setTableRows] = useState([]);
  const [currentItem, setCurrentItem] = useState({});
  const [searchTerm, setSearchTerm] = useState("");

  const [tableColumns, setTableColumns] = useState([
    {
      field: "name",
      headerName: "Name",
      width: 250,
      headerClassName: "products__column-header",
      renderCell: (params) => (
        <Box
          onClick={() => {
            const selectedItem = params.row;
            handleEditItemClick(selectedItem);
          }}
          sx={{
            width: "100%",
            height: "100%",
            backgroundColor: params.value,
            color: "white",
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
      renderCell: (params) => (
        <Box
          sx={{
            width: "100%",
            height: "100%",
            backgroundColor: params.value,
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            paddingLeft: 1,
          }}
        >
          <div>{params.value}</div>
        </Box>
      ),
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
            backgroundColor: params.value,
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            paddingLeft: 1,
          }}
        >
          <div>{params.value}</div>
        </Box>
      ),
    },
    {
      field: "price",
      headerName: "Price",
      width: 150,
      headerClassName: "products__column-header",
      renderCell: (params) => (
        <Box
          sx={{
            width: "100%",
            height: "100%",
            backgroundColor: params.value,
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            paddingLeft: 1,
          }}
        >
          <div>{params.value}</div>
        </Box>
      ),
    },
  ]);

  const filteredRows = tableRows.filter((row) =>
    row.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );
  useEffect(() => {
    const token = localStorage.getItem("jwt");
    getProducts(token).then((data) => {
      const productList = data.products;
      setTableRows(productList);
    });
  }, [activeModal]);

  function handleAddItemClick() {
    setActiveModal("add-item");
  }

  function handleEditItemClick(item) {
    setCurrentItem(item);
    setActiveModal("edit item");
  }

  function handleCreateItemSubmit(itemData) {
    const { itemName, itemVisualColor, quantityUnit } = itemData;
    const token = localStorage.getItem("jwt");

    const formattedData = {
      name: itemName,
      visual: itemVisualColor,
      quantity: quantityUnit,
      price: `$${parseFloat(itemData.itemPrice).toFixed(2).toString()}`,
    };
    createProduct(formattedData, token).then((data) => {
      setTableRows([...tableRows, data.data]);
    });
  }

  return (
    <>
      <div className="products">
        <div className="products__header">
          <h3 className="products__header-title">Products</h3>
          {/*<button
            className="products__create-item-button"
            onClick={handleAddItemClick}
          >
            + Item
          </button>*/}
        </div>
        <Box
          sx={{
            padding: 2.5,
            width: "100%",
            "&.products__column-header": {
              bgcolor: "transparent",
            },
          }}
        >
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
            columns={tableColumns}
            getRowId={(row) => row._id}
            sx={{
              color: "white",
            }}
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
      />
    </>
  );
}
