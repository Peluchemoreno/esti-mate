// src/contexts/ProductsContext.jsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getProducts } from "../utils/api";

const ProductsContext = createContext(null);

export function ProductsProvider({ children }) {
  const queryClient = useQueryClient();
  const [products, setProducts] = useState([]);
  const [version, setVersion] = useState(
    () => Number(localStorage.getItem("catalogVersion")) || 0
  );
  const [loading, setLoading] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("jwt");
      if (!token) {
        setProducts([]);
        return;
      }
      const data = await getProducts(token); // keep your existing api signature
      const list = Array.isArray(data) ? data : data?.products ?? [];
      setProducts(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    const bump = async () => {
      await reload();
      setVersion(Number(localStorage.getItem("catalogVersion")) || Date.now());
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["gutterProducts"] });
      queryClient.invalidateQueries({ queryKey: ["downspoutProducts"] });
    };
    const onCustom = () => bump();
    const onStorage = (e) => {
      if (e.key === "catalogVersion") bump();
    };
    window.addEventListener("catalog:updated", onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("catalog:updated", onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, [queryClient]);

  const value = useMemo(
    () => ({ products, reload, loading, version }),
    [products, loading, version]
  );

  return (
    <ProductsContext.Provider value={value}>
      {children}
    </ProductsContext.Provider>
  );
}

export const useProductsCatalog = () => useContext(ProductsContext);
