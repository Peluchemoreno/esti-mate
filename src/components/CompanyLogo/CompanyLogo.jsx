import "./CompanyLogo.css";

import { useContext, useEffect, useState } from "react";
import { BASE_URL } from "../../utils/constants";

export default function CompanyLogo({ token, currentUser }) {
  const [logoUrl, setLogoUrl] = useState(null);

  useEffect(() => {
    fetch(`${BASE_URL}users/${currentUser._id}/logo`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const imageUrl = URL.createObjectURL(blob);
        setLogoUrl(imageUrl);
      })
      .catch((err) => console.error("Failed to fetch logo:", err));
  }, [token]);

  return (
    logoUrl && (
      <img
        className="settings__company-logo"
        src={logoUrl}
        alt="Company Logo"
      />
    )
  );
}
