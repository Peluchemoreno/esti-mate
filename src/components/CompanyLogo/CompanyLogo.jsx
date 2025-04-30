import "./CompanyLogo.css";

import { useContext, useEffect, useState } from "react";
import { BASE_URL } from "../../utils/constants";


export default function CompanyLogo({ logoUrl }) {
  if (!logoUrl) return null;

  return (
    <img
      src={logoUrl}
      alt="Company Logo"
      style={{ width: 150, height: 150, objectFit: "contain" }}
    />
  );
}
