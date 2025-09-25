import "./EditProductModal.css";
import { useState, useEffect } from "react";
import { updateProduct, deleteProduct } from "../../utils/api";
import { useQueryClient } from "@tanstack/react-query";
import { useProductsCatalog } from "../../contexts/ProductsContext";

export default function EditProductModal({
  activeModal,
  closeModal,
  product,
  refresh,
}) {
  const [itemName, setItemName] = useState("");
  const [itemVisualColor, setItemVisualColor] = useState("#000000");
  const [quantityUnit, setQuantityUnit] = useState("length-feet");
  const [itemPrice, setItemPrice] = useState("");
  const [description, setDescription] = useState("");
  const [removalPrice, setRemovalPrice] = useState("");
  const [repairPrice, setRepairPrice] = useState("");
  const [category, setCategory] = useState("gutter");
  const [isListed, setIsListed] = useState(true);
  const [screenOptions, setScreenOptions] = useState([]);
  const [addScreenInputsOpen, setAddScreenInputsOpen] = useState(false);
  const [screenInputName, setScreenInputName] = useState("");
  const [screenInputPrice, setScreenInputPrice] = useState("");
  const [screenName, setScreenName] = useState("");
  const [screenPrice, setScreenPrice] = useState("");

  useEffect(() => {
    console.log(product);
    setItemName(product?.name || "defualt name");

    // Prefer whatever the server now stores (color), else fall back to legacy fields.
    const seededColor =
      product?.color ||
      product?.colorCode ||
      product?.defaultColor ||
      product?.visual ||
      "#000000";
    setItemVisualColor(seededColor);

    setQuantityUnit(product?.unit === "foot" ? "length-feet" : "unit/per");
    setItemPrice(product?.price || "0.00");
    setDescription(
      product?.description || "No description, how about we add one?"
    );
    // setScreenOptions(product.gutterGuardOptions);
  }, [product, activeModal]);

  const productsCtx =
    (typeof useProductsCatalog === "function" ? useProductsCatalog() : null) ||
    {};
  const reloadProductsCatalog =
    productsCtx.reload || productsCtx.refetch || null;

  function handleCategoryChange(e) {
    setCategory(e.target.value);
  }

  function handleScreenNameChange(e) {
    setScreenName(e.target.value);
  }

  function handleScreenPriceChange(e) {
    setScreenPrice(e.target.value);
  }

  function handleIsListedChange(e) {
    setIsListed(e.target.checked);
  }

  function handleItemNameChange(e) {
    setItemName(e.target.value);
  }

  function handleRemovalPriceChange(e) {
    setRemovalPrice(e.target.value);
  }

  function handleRepairPriceChange(e) {
    setRepairPrice(e.target.value);
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

  function handleScreenInputNameChange(e) {
    setScreenInputName(e.target.value);
  }

  function handleScreenInputPriceChange(e) {
    setScreenInputPrice(e.target.value);
  }

  // EditProductModal.jsx  (replace handleItemUpdateSubmit)
  // ...
  const queryClient = useQueryClient();

  async function handleItemUpdateSubmit(e) {
    e.preventDefault();
    const token = localStorage.getItem("jwt");
    if (!token) return;

    const payload = {
      productId: product._id,
      name: itemName,
      colorCode: itemVisualColor,
      unit: quantityUnit === "length-feet" ? "foot" : "unit",
      price: Number(itemPrice),
      type: product?.type || "gutter",
      description,
      category,
      listed: isListed,
      removalPricePerFoot: removalPrice ? Number(removalPrice) : undefined,
      repairPricePerFoot: repairPrice ? Number(repairPrice) : undefined,
      gutterGuardOptions: screenOptions?.map((o) => ({
        name: o.name,
        price: Number(o.price),
      })),
    };

    try {
      await updateProduct(payload, token); // your api helper
      // invalidate caches used by Products/Diagram/PDF
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["gutterProducts"] });
      queryClient.invalidateQueries({ queryKey: ["downspoutProducts"] });
      // tell other tabs/routes to refresh their local lists
      window.dispatchEvent(new Event("products-updated"));
      closeModal();
      // ---- begin: instant catalog propagation ----
      try {
        // 1) refresh context (if provided by your app)
        if (typeof reloadProductsCatalog === "function") {
          await reloadProductsCatalog(); // make the context push new products to all subscribers
        }

        // 2) broadcast an in-tab event
        window.dispatchEvent(
          new CustomEvent("catalog:updated", { detail: { ts: Date.now() } })
        );

        // 3) bump a cross-tab version so other tabs/windows pick it up
        localStorage.setItem("catalogVersion", String(Date.now()));
      } catch (e) {
        console.warn("catalog propagation warning:", e);
      }
      // ---- end: instant catalog propagation ----
    } catch (err) {
      console.error("Update failed", err);
    }
    queryClient.setQueryData(["products"], (old = []) =>
      old.map((p) =>
        p._id === product._id
          ? {
              ...p,
              price: Number(itemPrice),
              colorCode: itemVisualColor,
              description,
              type: p.type || "gutter",
              listed: isListed,
            }
          : p
      )
    );
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
              className="add-item-name__input add-item-form__input input_disabled"
              type="text"
              id="item-name"
              onChange={handleItemNameChange}
              value={itemName}
              disabled={true}
              required
            />
          </label>
          <label htmlFor="description" className="add-item__label">
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
          {/* <label
            htmlFor="category"
            className="add-item__label add-item__quantity-select-label"
          >
            <div>Category</div>
            <select
              name="quantity-select"
              id="quantity"
              className="add-item__quantity-select"
              onChange={handleCategoryChange}
              value={category}
            >
              <option className="add-item__select-option" value="gutter">
                Gutter
              </option>
              <option className="add-item__select-option" value="downspout">
                Downspout
              </option>
              <option className="add-item__select-option" value="accessory">
                Accessory
              </option>
              <option className="add-item__select-option" value="guard">
                Guard
              </option>
            </select>
          </label>
 */}
          {/*           <label
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
          </label> */}
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
          {/* <label
            htmlFor="price_removal"
            className="add-item__label add-item__price-label"
          >
            <div>Removal Price</div>

            <span className="add-item__price-dollar-sign">$</span>
            <input
              type="text"
              className="add-item-price__input add-item-form__input"
              onChange={handleRemovalPriceChange}
              value={removalPrice}
              required
              id="price_removal"
            />
          </label>
          <label
            htmlFor="price_repair"
            className="add-item__label add-item__price-label"
          >
            <div>Repair/Clean Price</div>

            <span className="add-item__price-dollar-sign">$</span>
            <input
              type="text"
              className="add-item-price__input add-item-form__input"
              onChange={handleRepairPriceChange}
              value={repairPrice}
              required
              id="price_repair"
            />
          </label>
          <label
            htmlFor="show-in-canvas"
            className="add-item__label"
            style={{ display: "flex", justifyContent: "space-between" }}
          >
            <div>Show in Diagram Toolbar?</div>

            <input
              type="checkbox"
              onChange={handleIsListedChange}
              checked={isListed}
            />
          </label> */}

          {/* {product.type === "gutter" && (
            <label htmlFor="quantity" className="add-item__label">
              <div>Screen Options</div>
              <div>
                {screenOptions?.map((option) => {
                  return (
                    <div className="table-row">
                      <input
                        type="text"
                        defaultValue={option?.name}
                        onChange={handleScreenNameChange}
                        className="add-item-form__input"
                      />
                      <input
                        type="text"
                        defaultValue={option?.price.toFixed(2)}
                        onChange={handleScreenPriceChange}
                        className="add-item-price__input add-item-form__input"
                      />
                    </div>
                  );
                })}
                {addScreenInputsOpen && (
                  <div className="table-row">
                    <input
                      type="text"
                      value={screenInputName}
                      onChange={handleScreenInputNameChange}
                      className="add-item-form__input"
                    />
                    <input
                      type="text"
                      value={screenInputPrice}
                      onChange={handleScreenInputPriceChange}
                      className="add-item-form__input add-item-price__input"
                    />
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  if (addScreenInputsOpen) {
                    if (!screenInputName || !screenInputPrice) {
                      setAddScreenInputsOpen(false);
                      return;
                    }
                    setScreenOptions([
                      ...screenOptions,
                      {
                        name: screenInputName,
                        price: parseFloat(screenInputPrice),
                      },
                    ]);
                    setScreenInputPrice("");
                    setScreenInputName("");
                    setAddScreenInputsOpen(false);
                  } else {
                    console.log(addScreenInputsOpen);
                    setAddScreenInputsOpen(true);
                  }
                }}
                type="button"
                className="add-item-form__screen-add-button"
              >
                + Add Screen
              </button>
            </label>
          )} */}
        </div>
        <div className="add-item-form__footer">
          {/* <button
            type="button"
            onClick={handleItemDeleteClick}
            className="edit-product-delete-button"
          >
            Delete product
          </button> */}
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
