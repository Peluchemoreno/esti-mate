// src/contexts/ProductsContext.jsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getCatalogItems, getProducts } from "../utils/api";

const ProductsContext = createContext(null);

export function ProductsProvider({ children }) {
  const queryClient = useQueryClient();
  const [products, setProducts] = useState([]);
  const [version, setVersion] = useState(
    () => Number(localStorage.getItem("catalogVersion")) || 0,
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
      // here I'm manually combining the catalog items with the products list to show the catalog items in the UI immediately, without waiting for the products endpoint to be updated with the new items. This is a temporary measure until we have a more robust solution for syncing the catalog and products..

      const legacyProducts = await getProducts(token, "listed");
      const catalogItems = await getCatalogItems(token);

      const combined = [
        ...(Array.isArray(legacyProducts) ? legacyProducts : []),
        ...(Array.isArray(catalogItems) ? catalogItems : []),
      ];

      setProducts(combined);
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
    [products, loading, version],
  );

  return (
    <ProductsContext.Provider value={value}>
      {children}
    </ProductsContext.Provider>
  );
}

export const useProductsCatalog = () => useContext(ProductsContext);
