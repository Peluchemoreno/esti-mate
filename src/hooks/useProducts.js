// src/hooks/useProducts.js
import { useQuery } from "@tanstack/react-query";
import { getProducts, getCatalogItems } from "../utils/api";
import { useProductsCatalog } from "../contexts/ProductsContext";

// Shared token getter
function useToken() {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("jwt");
  } catch {
    return null;
  }
}

/**
 * UI list (listed-only). Default endpoint.
 * Cache key: ["products","listed",version]
 */
export function useProductsListed() {
  const token = useToken();
  const { version } = useProductsCatalog() || {};

  return useQuery({
    queryKey: ["products", "listed", version],
    queryFn: async () => {
      if (!token) return [];
      // here I'm manually combining the catalog items with the products list to show the catalog items in the UI immediately, without waiting for the products endpoint to be updated with the new items. This is a temporary measure until we have a more robust solution for syncing the catalog and products..
      const catalogItems = await getCatalogItems(token);
      const list = await getProducts(token, "listed");

      return [
        ...(Array.isArray(list) ? list : []),
        ...(Array.isArray(catalogItems) ? catalogItems : []),
      ];
    },
    enabled: !!token,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * Pricing view (ALL items). ?scope=pricing
 * Cache key: ["products","pricing",version]
 */
export function useProductsPricing() {
  const token = useToken();
  const { version } = useProductsCatalog() || {};

  return useQuery({
    queryKey: ["products", "pricing", version],
    queryFn: async () => {
      if (!token) return [];

      const legacyProducts = await getProducts(token, "pricing");
      const catalogItems = await getCatalogItems(token);

      return [
        ...(Array.isArray(legacyProducts) ? legacyProducts : []),
        ...(Array.isArray(catalogItems) ? catalogItems : []),
      ];
    },
    enabled: !!token,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  });
}
