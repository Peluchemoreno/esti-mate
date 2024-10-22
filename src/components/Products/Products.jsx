import "./Products.css";
import { DataGrid, gridClasses, GridToolbar } from "@mui/x-data-grid";
import { Box } from "@mui/material/";
import { useState } from "react";
import AddProductModal from "../AddProductModal/AddProductModal";


export default function Products({activeModal, setActiveModal, closeModal}) {
  const [tableData, setTableData] = useState({
    rows: [
      { id: 1, col1: `6" K-Style`, col2: 'red' , col3: "Length/Feet", col4: '$12.15'},
      { id: 2, col1: `5" Half Round`, col2: 'orange' , col3: "Length/Feet", col4: '$24.10' },
      { id: 3, col1: "Euro Box", col2: 'yellow' , col3: "Length/Feet", col4: '$24.15' },
      { id: 4, col1: `5" K-Style`, col2: 'green' , col3: "Length/Feet", col4: '$10.15' },
      { id: 5, col1: `5" Straight Face`, col2: 'blue' , col3: "Length/Feet", col4: '$15.15' },
      { id: 6, col1: `6" Straight Face`, col2: 'magenta' , col3: "Length/Feet", col4: '$18.05' },
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


  function handleAddItemClick(){
    setActiveModal('add-item')
  }

  return (
    <>
    <div className="products">
      <div className="products__header">
        <h3 className="products__header-title">
        Products
        </h3>
        <button className="products__create-item-button" onClick={handleAddItemClick}>+ Item</button>
      </div>
      <Box
        sx={{
          padding: 2,
          width: "100%",
          "& .products__column-header": {
            bgcolor: "transparent",
          },
          fontWeight: "bold",
          [`.${gridClasses.cell}.red`]: {
            backgroundColor: 'red',
            color: 'white',
            fontWeight: 'bold'
          },
          [`.${gridClasses.cell}.orange`]: {
            backgroundColor: 'orange',
            color: 'white',
            fontWeight: 'bold'
          },
          [`.${gridClasses.cell}.yellow`]: {
            backgroundColor: 'yellow',
            color: 'black',
            fontWeight: 'bold'
          },
          [`.${gridClasses.cell}.green`]: {
            backgroundColor: 'green',
            color: 'black',
            fontWeight: 'bold'
          },
          [`.${gridClasses.cell}.blue`]: {
            backgroundColor: 'blue',
            color: 'white',
            fontWeight: 'bold'
          },
          [`.${gridClasses.cell}.magenta`]: {
            backgroundColor: 'magenta',
            color: 'white',
            fontWeight: 'bold'
          },
        }}
      >
        <DataGrid
          rows={tableData.rows}
          columns={tableData.columns}
          
          getCellClassName={(params)=>{
            if (params.field === 'col1' || params.value == null){
              return ''
            }
            switch (params.value){
              case 'red':
                return 'red'
              case 'orange':
                return 'orange'
              case 'yellow':
                return 'yellow'
              case 'green':
                return 'green'
              case 'blue':
                return 'blue'
              case 'magenta':
                return 'magenta'
            }
          }}
          sx={{
            color: "white",
          }}
        />
      </Box>
    </div>
    <AddProductModal activeModal={activeModal} closeModal={closeModal}/>
    </>
  );
}
