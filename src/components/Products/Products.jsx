import "./Products.css";
import { DataGrid, gridClasses, GridToolbar } from "@mui/x-data-grid";
import { Box } from "@mui/material/";
import { useState } from "react";
import AddProductModal from "../AddProductModal/AddProductModal";


export default function Products({activeModal, setActiveModal, closeModal}) {
 
  const [tableRows, setTableRows] = useState(
    [
    // { id: 1, col1: `6" K-Style`, col2: 'red' , col3: "Length/Feet", col4: '$12.15'},
    // { id: 2, col1: `5" Half Round`, col2: 'orange' , col3: "Length/Feet", col4: '$24.10' },
    // { id: 3, col1: "Euro Box", col2: 'yellow' , col3: "Length/Feet", col4: '$24.15' },
    // { id: 4, col1: `5" K-Style`, col2: 'green' , col3: "Length/Feet", col4: '$10.15' },
    // { id: 5, col1: `5" Straight Face`, col2: 'blue' , col3: "Length/Feet", col4: '$15.15' },
    // { id: 6, col1: `6" Straight Face`, col2: 'magenta' , col3: "Length/Feet", col4: '$18.05' },
  ])

  const [tableColumns, setTableColumns] = useState([
    {
      field: "col1",
      headerName: "Name",
      width: 150,
      headerClassName: "products__column-header",
      renderCell: (params) =>(
        <Box sx ={{
          width: '100%',
          height: '100%',
          backgroundColor: params.value,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: "flex-start",
        }}>
          <div className="cell-data">
            {params.value}
          </div>
        </Box>
      )
    },
    {
      field: "col2",
      headerName: "Visual",
      width: 150,
      headerClassName: "products__column-header",
      renderCell: (params) =>(
        <Box sx ={{
          width: '100%',
          height: '100%',
          backgroundColor: params.value,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: "flex-start",
          paddingLeft: 1
        }}>
          <div className="cell-data">
            {params.value}
          </div>
        </Box>
      )
    },
    {
      field: "col3",
      headerName: "Quantity",
      width: 150,
      headerClassName: "products__column-header",
      renderCell: (params) =>(
        <Box sx ={{
          width: '100%',
          height: '100%',
          backgroundColor: params.value,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: "flex-start",
          paddingLeft: 1
        }}>
          <div className="cell-data">
            {params.value}
          </div>
        </Box>
      )
    },
    {
      field: "col4",
      headerName: "Price",
      width: 150,
      headerClassName: "products__column-header",
      renderCell: (params) =>(
        <Box sx={{
          width: '100%',
          height: '100%',
          backgroundColor: params.value,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: "flex-start",
          paddingLeft: 1
        }}>
          <div className="cell-data">
            {params.vaule === undefined ? '$0.00' : params.value}
          </div>
        </Box>
      )
    },
  ])




  function handleAddItemClick(){
    setActiveModal('add-item')
  }

  function openEditItem(item){

  }

  function handleCreateItemSubmit(itemData){
    console.log(itemData)
    setTableRows([...tableRows, {
      id: `${tableRows.length + 1}`,
      col1: itemData.itemName,
      col2: itemData.itemVisualColor,
      col3: `${itemData.quantityUnit === 'length-feet' ? 'Length/Feet' : 'Unit/Per'}` ,
      col4: `$${itemData.itemPrice}`,
    }])
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
          "&.products__column-header":{
            bgcolor: 'transparent'
          },
          
          
        }}
      >
        <DataGrid
          rows={tableRows}
          columns={tableColumns}
          sx={{
            color: "white",
          }}
        />
      </Box>
    </div>
    <AddProductModal activeModal={activeModal} closeModal={closeModal} submitItem={handleCreateItemSubmit}/>
    </>
  );
}
