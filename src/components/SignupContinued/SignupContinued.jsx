import "./SignupContinued.css";
import { Link, useNavigate } from "react-router-dom";
import estimateLogo from "../../assets/estimate-nobackground-blue.png";
import { useEffect, useState } from "react";

export default function SignupContinued({ userData, handleSignUp }) {
  useEffect(() => {
    console.log(userData);
  }, []);

  const [companyName, setCompanyName] = useState("");
  const [logo, setLogo] = useState(null);
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");

  function handleCompanyNameChange(e) {
    setCompanyName(e.target.value);
  }

  function handleFileChange(e) {
    setLogo(e.target.files[0]);
  }

  function handleSubmit(e) {
    e.preventDefault();
    userData = { ...userData, companyName, companyAddress, companyPhone };
    console.log(userData);

    handleSignUp(userData, logo);
  }

  function handleChangeCompanyAddress(e) {
    setCompanyAddress(e.target.value);
  }

  function handleChangeCompanyPhone(e) {
    setCompanyPhone(e.target.value);
  }

  useEffect(() => {
    console.log(userData);
  }, [userData]);
  return (
    <>
      <Link to="/">
        <img
          src={estimateLogo}
          alt="sign in header logo"
          className="signin__header-logo__form-cont"
        />
      </Link>
      <form className="signup__form signup__form-cont" onSubmit={handleSubmit}>
        <h2 className="signup__header">Just a few more details</h2>
        <label htmlFor="companyName" className="signup__form-label">
          Company name *
          <input
            required
            type="text"
            className="signup__form-input signup__form-input_firstName input"
            onChange={handleCompanyNameChange}
            value={companyName}
            id="companyName"
          />
        </label>
        <label htmlFor="companyAddress" className="signup__form-label">
          Business Address *
          <input
            required
            type="text"
            className="signup__form-input signup__form-input_firstName input"
            onChange={handleChangeCompanyAddress}
            value={companyAddress}
            id="companyAddress"
          />
        </label>
        <label htmlFor="companyPhone" className="signup__form-label">
          Business Phone Number *
          <input
            required
            type="text"
            className="signup__form-input signup__form-input_firstName input"
            onChange={handleChangeCompanyPhone}
            value={companyPhone}
            id="companyPhone"
          />
        </label>
        <label htmlFor="companyLogo" className="signup__form-label">
          Company Logo * (.png, .jpeg, or .jpg)
          <input
            className="signup__form-logo-upload"
            type="file"
            name="companyLogo"
            id="companyLogo"
            accept="image/*"
            onChange={handleFileChange}
          />
        </label>

        <button type="submit" className="signin__button signin-cont__button">
          Sign Up
        </button>
        <Link to={"/signup"}>
          <button className="signup__form-back-button button">Back</button>
        </Link>
      </form>
    </>
  );
}
