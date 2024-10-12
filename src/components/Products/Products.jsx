import "./Products.css";
import { DataGrid } from "@mui/x-data-grid";
import { Box } from "@mui/material/";
import { useState } from "react";


export default function Products() {
  const [tableData, setTableData] = useState({
    rows: [
      { id: 1, col1: `6" K-Style`, col2: {} , col3: "Length/Feet", col4: '$12.15'},
      { id: 2, col1: `5" Half Round`, col2: {} , col3: "Length/Feet", col4: '$24.10' },
      { id: 3, col1: "Euro Box", col2: {} , col3: "Length/Feet", col4: '$24.15' },
      { id: 4, col1: `5" K-Style`, col2: {} , col3: "Length/Feet", col4: '$10.15' },
      { id: 5, col1: `5" Straight Face`, col2: {} , col3: "Length/Feet", col4: '$15.15' },
      { id: 6, col1: `6" Straight Face`, col2: {} , col3: "Length/Feet", col4: '$18.05' },
    ],
    columns: [
      {
        field: "col1",
        headerName: "Name",
        width: 150,
        headerClassName: "products__column-header",
      },
      {
        field: "col2",
        headerName: "Visual",
        width: 150,
        headerClassName: "products__column-header",
      },
      {
        field: "col3",
        headerName: "Quantity",
        width: 150,
        headerClassName: "products__column-header",
      },
      {
        field: "col4",
        headerName: "Price",
        width: 150,
        headerClassName: "products__column-header",
      },
    ],
  });

  return (
    <div className="products">
      <div className="products__header">
        <h3 className="products__header-title">
        Products
        </h3>
        <button className="products__add-product-button">+ Item</button>
      </div>
      <Box
        sx={{
          padding: 2,
          width: "100%",
          "& .products__column-header": {
            bgcolor: "transparent",
          },
          fontWeight: "bold",
        }}
      >
        <DataGrid
          rows={tableData.rows}
          columns={tableData.columns}
          sx={{
            color: "white",
          }}
        />
      </Box>
    </div>
  );
}
