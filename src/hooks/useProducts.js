// src/hooks/useProducts.js
import { useQuery } from "@tanstack/react-query";
import { getProducts } from "../utils/api";
import { useProductsCatalog } from "../contexts/ProductsContext";

export function useProducts() {
  const { version } = useProductsCatalog() || {};
  const token =
    typeof window !== "undefined" ? localStorage.getItem("jwt") : null;

  return useQuery({
    queryKey: ["products", version],
    queryFn: async () => {
      if (!token) return [];
      const data = await getProducts(token); // keep your existing api call signature
      const list = Array.isArray(data) ? data : data?.products ?? [];
      return Array.isArray(list) ? list : [];
    },
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    enabled: !!token,
  });
}
