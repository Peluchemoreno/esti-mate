import "./EditProductModal.css";
import { useState, useEffect } from "react";
import { updateProduct, deleteProduct } from "../../utils/api";

export default function EditProductModal({ activeModal, closeModal, product }) {
  const [itemName, setItemName] = useState("");
  const [itemVisualColor, setItemVisualColor] = useState("#000000");
  const [quantityUnit, setQuantityUnit] = useState("length-feet");
  const [itemPrice, setItemPrice] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    console.log(product);
    setItemName(product?.name || "defualt name");
    setItemVisualColor(product?.colorCode || "#000000");
    setQuantityUnit(product?.unit === "foot" ? "length-feet" : "unit/per");
    setItemPrice(product?.price || "0.00");
    setDescription(
      product?.description || "No description, how about we add one?",
    );
  }, [product, activeModal]);

  function handleItemNameChange(e) {
    setItemName(e.target.value);
  }

  function handleItemVisualColorChange(e) {
    setItemVisualColor(e.target.value);
  }

  function handleQuantityUnitChange(e) {
    setQuantityUnit(e.target.value);
  }

  function handlePriceChange(e) {
    setItemPrice(e.target.value);
  }

  function handleDescriptionChange(e) {
    setDescription(e.target.value);
  }

  function handleCloseModal(e) {
    closeModal();
  }

  function handleItemUpdateSubmit(e) {
    e.preventDefault();
    const token = localStorage.getItem("jwt");
    const productData = {
      name: itemName,
      visual: itemVisualColor,
      quantity: quantityUnit,
      price: `$${parseFloat(itemPrice).toFixed(2).toString()}`,
      productId: product._id,
    };
    updateProduct(productData, token);

    closeModal();
  }

  function handleItemDeleteClick() {
    const token = localStorage.getItem("jwt");
    const productData = {
      productId: product._id,
    };
    deleteProduct(productData, token);
    closeModal();
  }

  function isUpdateButtonDisabled() {
    //if (
    // itemName === product?.name &&
    // itemPrice === product?.price.replace("$", "") &&
    //itemVisualColor === product?.visual &&
    //quantityUnit === product?.quantity
    //) {
    // return true;
    //}
    // return false;
  }

  return (
    <div
      className={activeModal === "edit item" ? "modal modal_visible" : "modal"}
    >
      <form onSubmit={handleItemUpdateSubmit} className="add-item-form">
        <header className="add-item-form__header">
          <h3 className="add-item-form__header-text">Update Item</h3>
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
              required
            />
          </label>
          <label
            htmlFor="visual"
            className="add-item__label add-item__visual-label"
          >
            <div>Visual</div>
            <input
              type="color"
              className="add-item__color-select"
              onChange={handleItemVisualColorChange}
              value={itemVisualColor}
            />
          </label>
          <label
            htmlFor="quantity"
            className="add-item__label add-item__quantity-select-label"
          >
            <div>Quantity</div>
            <select
              name="quantity-select"
              id="quantity"
              className="add-item__quantity-select"
              onChange={handleQuantityUnitChange}
              value={quantityUnit}
            >
              <option className="add-item__select-option" value="length-feet">
                Length/Feet
              </option>
              <option className="add-item__select-option" value="unit-per">
                Unit/Per
              </option>
            </select>
          </label>
          <label
            htmlFor="price"
            className="add-item__label add-item__price-label"
          >
            <div>Price</div>

            <span className="add-item__price-dollar-sign">$</span>
            <input
              type="text"
              className="add-item-price__input add-item-form__input"
              onChange={handlePriceChange}
              value={itemPrice}
              required
            />
          </label>
          <label
            htmlFor="description"
            className="add-item__label add-item__price-label"
          >
            <div>Description</div>

            <textarea
              type="text"
              className="add-item-form__input add-item-form__description"
              onChange={handleDescriptionChange}
              value={description}
              required
            >
              {description}
            </textarea>
          </label>
        </div>
        <div className="add-item-form__footer">
          <button
            type="button"
            onClick={handleItemDeleteClick}
            className="edit-product-delete-button"
          >
            Delete product
          </button>
          <div>
            <button
              onClick={handleCloseModal}
              type="button"
              className="add-item-form__button_cancel"
            >
              Cancel
            </button>
            <button
              disabled={isUpdateButtonDisabled()}
              type="submit"
              className="add-item-form__button_create"
            >
              Update
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
