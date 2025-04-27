import { useContext, useEffect, useState } from "react";
import "./Settings.css";
import { getCompanyLogo } from "../../utils/auth";
import CompanyLogo from "../CompanyLogo/CompanyLogo";

export default function Settings({ currentUser }) {
  const [token, setToken] = useState("");
  useEffect(() => {
    const token = localStorage.getItem("jwt");
    setToken(token);
    getCompanyLogo(currentUser._id, token);
  }, [currentUser]);

  useEffect(() => {
    console.log(currentUser);
  }, []);
  return (
    <div className="settings">
      <h3 className="settings__header-title">Settings</h3>
      <div className="settings__body">
        <form className="settings__form">
          <label htmlFor="firstName" className="signup__form-label">
            Company Logo
            <CompanyLogo token={token} currentUser={currentUser}></CompanyLogo>
            <input
              required
              type="file"
              className="signup__form-input signup__form-input_firstName input"
            />
          </label>
        </form>
        <label htmlFor="firstName" className="settings__label">
          Company Name
          <input
            required
            type="text"
            className="signup__form-input settings__input"
            value={currentUser.companyName}
          />
        </label>
        <label htmlFor="firstName" className="signup__form-label">
          Business Address
          <input
            required
            type="text"
            className="signup__form-input signup__form-input_firstName input"
            value={currentUser.companyAddress}
          />
        </label>
        <label htmlFor="firstName" className="signup__form-label">
          Business Phone Number
          <input
            required
            type="text"
            className="signup__form-input signup__form-input_firstName input"
            value={currentUser.companyPhone}
          />
        </label>
      </div>
    </div>
  );
}
