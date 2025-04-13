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

  function handleCompanyNameChange(e) {
    setCompanyName(e.target.value);
    console.log(companyName);
  }

  function handleFileChange(e) {
    setLogo(e.target.files[0]);
  }

  function handleSubmit(e) {
    e.preventDefault();

    userData.companyName = companyName;
    console.log(userData.email, userData.password, logo);

    handleSignUp(userData, logo);
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
        <label htmlFor="companyLogo">
          <input
            type="file"
            name="companyLogo"
            id="companyLogo"
            accept="image/*"
            onChange={handleFileChange}
          />
        </label>

        <button type="submit">Next</button>
      </form>
    </>
  );
}
