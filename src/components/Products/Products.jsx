import "./Products.css";
import { DataGrid } from "@mui/x-data-grid";
import { Box } from "@mui/material/";
import { useState } from "react";

export default function Products() {
  const [tableData, setTableData] = useState({
    rows: [
      { id: 1, col1: `6" Gutters`, col2: "Length/Feet" },
      { id: 2, col1: "DataGridPro", col2: "is Awesome" },
      { id: 3, col1: "MUI", col2: "is Amazing" },
      { id: 4, col1: `5" Gutters`, col2: "Length/Feet" },
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
        headerName: "Price",
        width: 150,
        headerClassName: "products__column-header",
      },
    ],
  });

  return (
    <div className="products">
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
