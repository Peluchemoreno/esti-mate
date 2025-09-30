import { useContext, useEffect, useState } from "react";
import "./Settings.css";
import { getCompanyLogo, updateUserInfo, uploadLogo } from "../../utils/auth";
import CompanyLogo from "../CompanyLogo/CompanyLogo";

export default function Settings({ currentUser, setCurrentUser }) {
  const [logoInputVisible, setLogoInputVisible] = useState(false);
  const [token, setToken] = useState("");
  const [companyName, setCompanyName] = useState(currentUser.companyName);
  const [companyAddress, setCompanyAddress] = useState(
    currentUser.companyAddress
  );
  const [companyPhoneNumber, setCompanyPhoneNumber] = useState(
    currentUser.companyPhone
  );
  const [logoFile, setLogoFile] = useState(null);
  const [dummyState, setDummyState] = useState(false);

  const [logoUrl, setLogoUrl] = useState(null);

  function ManageBillingButton({ token }) {
    async function openPortal() {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}api/billing/portal`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) {
        alert("Could not open billing portal");
        return;
      }
      const { url } = await res.json();
      window.location.assign(url);
    }
    return <button onClick={openPortal}>Manage billing</button>;
  }

  function handleCompanyNameChange(e) {
    setCompanyName(e.target.value);
    console.log(companyName);
  }

  function handleCompanyAddressChange(e) {
    setCompanyAddress(e.target.value);
    console.log(companyAddress);
  }

  function handleCompanyPhoneNumberChange(e) {
    setCompanyPhoneNumber(e.target.value);
    console.log(companyPhoneNumber);
  }

  function handleChangeLogoFile(e) {
    setLogoFile(e.target.files[0]);
  }

  function handleUpdateBusinessInfo(e) {
    const token = localStorage.getItem("jwt");
    e.preventDefault();
    const businessData = { companyName, companyAddress, companyPhoneNumber };
    console.log(businessData);
    console.log(currentUser.logo);

    updateUserInfo(businessData, token).then((data) => {
      setCurrentUser(data);
    });

    if (logoFile) {
      uploadLogo(logoFile, token).then(() => {
        if (currentUser?._id && token) {
          getCompanyLogo(currentUser._id, token).then(setLogoUrl);
        }
      });
    }
  }

  useEffect(() => {
    const token = localStorage.getItem("jwt");
    setToken(token);

    console.log("this is the logo call");
    if (currentUser?._id && token) {
      getCompanyLogo(currentUser._id, token)
        .then((url) => {
          setLogoUrl(url);
          console.log("Fetched logo:", url);
        })
        .catch((err) => {
          console.error("Failed to load logo:", err.message);
        });
    }
  }, [currentUser]);

  useEffect(() => {
    console.log(currentUser);
  }, []);
  return (
    <div className="settings">
      <h3 className="settings__header-title">Settings</h3>
      <div className="settings__body">
        <form className="settings__form" onSubmit={handleUpdateBusinessInfo}>
          <label htmlFor="firstName" className="signup__form-label">
            Company Logo
            <div style={{ border: "none", marginTop: "10px" }}>
              <CompanyLogo
                token={token}
                currentUser={currentUser}
                logoUrl={logoUrl}
              ></CompanyLogo>

              <p style={{ margin: "10px 0px 0px 0px" }}>Upload new logo:</p>
              <input
                type="file"
                className="signup__form-input signup__form-input_firstName input"
                onChange={handleChangeLogoFile}
              />
            </div>
          </label>
          <label htmlFor="firstName" className="">
            Company Name
            <input
              required
              type="text"
              className="signup__form-input input"
              value={companyName}
              onChange={handleCompanyNameChange}
            />
          </label>
          <label htmlFor="firstName" className="signup__form-label">
            Business Address
            <input
              required
              type="text"
              className="signup__form-input signup__form-input_firstName input"
              value={companyAddress}
              onChange={handleCompanyAddressChange}
            />
          </label>
          <label htmlFor="firstName" className="signup__form-label">
            Business Phone Number
            <input
              required
              type="text"
              className="signup__form-input signup__form-input_firstName input"
              value={companyPhoneNumber}
              onChange={handleCompanyPhoneNumberChange}
            />
          </label>
          <div className="add-item-form__footer_no-border">
            <button type="submit" className="add-item-form__button_create">
              Update
            </button>
          </div>
        </form>
        <ManageBillingButton token={token} />
      </div>
    </div>
  );
}
