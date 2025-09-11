import { useQuery } from "@tanstack/react-query";
import { getProducts } from "../utils/api";

function getToken() {
  return localStorage.getItem("jwt") || "";
}

export function useProducts() {
  const token = getToken();

  return useQuery({
    queryKey: ["products", token],
    queryFn: async () => {
      const res = await getProducts(token);

      const products = Array.isArray(res.products) ? res.products : [];
      return products;
    },
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1, // Retry once on failure
  });
}

// src/hooks/useProducts.js (add below the export above)
export function useGutterProducts() {
  return useProducts({
    select: (products) =>
      products.filter((p) => {
        console.log(p.category);
        return p.type === "gutter";
      }),
  });
}
