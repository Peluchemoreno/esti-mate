export function makePriceResolver(products) {
  // Build fast lookups
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const byTemplate = new Map(
    products
      .map((p) => (p.templateId ? [String(p.templateId), p] : null))
      .filter(Boolean)
  );
  const bySlug = new Map(
    products.map((p) => (p.slug ? [p.slug, p] : null)).filter(Boolean)
  );

  const norm = (s) => (s || "").toLowerCase().trim();

  // Fallback: normalize names a bit (last resort)
  const byName = new Map(
    products.map((p) => [norm(p.name).replace(/ gutter\b/i, ""), p])
  );

  return function resolve(lineItem) {
    // Prefer strong IDs passed from UI if available
    if (lineItem.productId && byId.has(String(lineItem.productId))) {
      return byId.get(String(lineItem.productId));
    }
    if (lineItem.templateId && byTemplate.has(String(lineItem.templateId))) {
      return byTemplate.get(String(lineItem.templateId));
    }
    if (lineItem.slug && bySlug.has(lineItem.slug)) {
      return bySlug.get(lineItem.slug);
    }

    // Try to derive slug from fields on the line item
    if (lineItem.type || lineItem.profile || lineItem.size) {
      const slug = `${norm(lineItem.type)}|${norm(lineItem.profile)}|${norm(
        lineItem.size
      )}`.replace(/\s+/g, "-");
      if (bySlug.has(slug)) return bySlug.get(slug);
    }

    // Last resort: loose name match (strips the word "gutter")
    if (lineItem.name) {
      const key = norm(lineItem.name).replace(/ gutter\b/i, "");
      if (byName.has(key)) return byName.get(key);
    }

    return null;
  };
}
