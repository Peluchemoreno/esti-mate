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
      const list = await getProducts(token, "listed");
      setProducts(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Call this ONLY after a successful product save (create/edit)
  const signalCatalogUpdated = () => {
    const next = Date.now();
    try {
      localStorage.setItem("catalogVersion", String(next));
    } catch {
      // ignore
    }
    window.dispatchEvent(new Event("catalog:updated"));
  };

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    const bump = async () => {
      // important: bump should refetch + invalidate ONCE per signal
      await reload();
      const v = Number(localStorage.getItem("catalogVersion")) || Date.now();
      setVersion(v);

      // invalidate react-query product queries
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
    () => ({ products, reload, loading, version, signalCatalogUpdated }),
    [products, loading, version]
  );

  return (
    <ProductsContext.Provider value={value}>
      {children}
    </ProductsContext.Provider>
  );
}

export const useProductsCatalog = () => useContext(ProductsContext);
