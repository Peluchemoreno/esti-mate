import "./CompanyLogo.css";

import { useContext, useEffect, useState } from "react";
import { BASE_URL } from "../../utils/constants";

export default function CompanyLogo({ logoUrl }) {
  if (!logoUrl) {
    return (
      <div
        style={{
          width: 150,
          height: 150,
          backgroundColor: "#f2f2f2",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          color: "#999",
        }}
      >
        Loading logo...
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt="Company Logo"
      style={{ width: 150, height: 150, objectFit: "contain" }}
    />
  );
}
