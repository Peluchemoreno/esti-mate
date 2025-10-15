export async function renderEstimateToBlob(EstimatePDF, props) {
  const { pdf } = await import("@react-pdf/renderer");
  const element = <EstimatePDF {...props} />;
  return pdf(element).toBlob();
}
