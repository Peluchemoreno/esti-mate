import { useState } from 'react'
import './AddProductModal.css'

export default function AddProductModal({activeModal, closeModal, submitItem}){

  const [itemName, setItemName] = useState('')
  const [itemVisualColor, setItemVisualColor] = useState('#000000')
  const [quantityUnit, setQuantityUnit] = useState('')
  const [itemPrice, setItemPrice] = useState('0.00')

  function handleItemNameChange(e){
    setItemName(e.target.value)
  }

  function handleItemVisualColorChange(e){
    setItemVisualColor(e.target.value)
  }

  function handleQuantityUnitChange(e){
    setQuantityUnit(e.target.value)
  }

  function handlePriceChange(e){
    setItemPrice(e.target.value)
  }

  function resetInputs(e){
    setItemName(e.target.value)
    setItemVisualColor('#000000')
    setQuantityUnit('length-feet')
    setItemPrice(e.target.value)
  }

  function handleCloseModal(e){
    resetInputs(e)
    closeModal()
  }

  function handleCreateItemSubmit(e){
    e.preventDefault()
    const itemData = {
      itemName,
      itemVisualColor,
      quantityUnit,
      itemPrice
    }
    resetInputs(e)
    closeModal()
    submitItem(itemData)
  }

  return (
    <div className={activeModal === 'add-item' ? 'modal modal_visible' : 'modal'}>
      <form className="add-item-form">
      <header className="add-item-form__header">
          <h3 className="add-item-form__header-text">
            Create New Item
          </h3>
        </header>
        <div className="add-item-form__body">
          <label className="add-item__label " htmlFor="item-name">
            Name
            <input
              className="add-item-name__input add-item-form__input"
              type="text"
              id="item-name"
              onChange={handleItemNameChange}
              value={itemName}
              placeholder='5" K-Style'
            />
          </label>
          <label htmlFor="visual" className="add-item__label add-item__visual-label">
            <div>Visual</div>
            <input type="color" className='add-item__color-select' onChange={handleItemVisualColorChange} value={itemVisualColor}/>
          </label>
          <label htmlFor="quantity" className="add-item__label add-item__quantity-select-label">
            <div>Quantity</div>
            <select name="quantity-select" id="quantity" className='add-item__quantity-select' onChange={handleQuantityUnitChange} value={quantityUnit}>
              <option className='add-item__select-option' value="length-feet">Length/Feet</option>
              <option className='add-item__select-option' value="unit-per">Unit/Per</option>
            </select>
          </label>
          <label htmlFor="price" className="add-item__label add-item__price-label">
            <div>Price</div>
            <input type="text" placeholder='0.00' className='add-item-price__input add-item-form__input' onChange={handlePriceChange} value={itemPrice}/>
          </label>

        </div>
        <div className="add-item-form__footer">
          <button
            onClick={handleCloseModal}
            type="button"
            className="add-item-form__button_cancel"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateItemSubmit}
            type="submit"
            className="add-item-form__button_create"
          >
            Create
          </button>
        </div>
      </form>
    </div>
  )
}