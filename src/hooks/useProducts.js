// src/hooks/useProducts.js
import { useQuery } from "@tanstack/react-query";
import { getProducts } from "../utils/api";
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
      return await getProducts(token, "ui"); // default (listed-only)
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
      return await getProducts(token, "pricing");
    },
    enabled: !!token,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  });
}
