import { useContext, useEffect, useState } from "react";
import "./Settings.css";
import { getCompanyLogo } from "../../utils/auth";
import CurrentUserContext from "../../contexts/CurrentUserContext/CurrentUserContext";
import CompanyLogo from "../CompanyLogo/CompanyLogo";

export default function Settings() {
  const [token, setToken] = useState("");
  const currentUser = useContext(CurrentUserContext);
  useEffect(() => {
    console.log(currentUser);
  });
  useEffect(() => {
    const token = localStorage.getItem("jwt");
    setToken(token);
    getCompanyLogo(currentUser._id, token);
  }, [currentUser]);

  return (
    <div className="settings">
      <h3 className="settings__header-title">Settings</h3>
      <CompanyLogo token={token}></CompanyLogo>
    </div>
  );
}
