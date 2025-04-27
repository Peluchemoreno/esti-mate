import "./Signup.css";
import logo from "../../assets/estimate-nobackground-blue.png";
import { Link, useNavigate } from "react-router-dom";
import { createProduct } from "../../utils/api";
import { useContext, useState } from "react";
import CurrentUserContext from "../../contexts/CurrentUserContext/CurrentUserContext";

export default function Signup({ handleSignupContinue }) {
  const currentUser = useContext(CurrentUserContext);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigator = useNavigate();

  function handleSignup(e) {
    e.preventDefault();

    const data = {
      firstName,
      lastName,
      email,
      password,
    };

    handleSignupContinue(data);
    navigator("cont");
  }

  function handleChangeFirstName(e) {
    setFirstName(e.target.value);
  }

  function handleChangeLastName(e) {
    setLastName(e.target.value);
  }

  function handleChangeEmail(e) {
    setEmail(e.target.value);
  }

  function handleChangePassword(e) {
    setPassword(e.target.value);
  }

  function clearInputs() {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPassword("");
  }

  return (
    <div className="signup">
      <Link className="signup__logo-link" to="/esti-mate">
        <img src={logo} alt="signup logo" className="signup__logo" />
      </Link>
      <form onSubmit={handleSignup} className="signup__form">
        <h2 className="signup__header">Sign up for Esti-Mate</h2>
        <label htmlFor="firstName" className="signup__form-label">
          First name *
          <input
            required
            type="text"
            className="signup__form-input signup__form-input_firstName input"
            onChange={handleChangeFirstName}
            value={firstName}
          />
        </label>
        <label htmlFor="lastName" className="signup__form-label">
          Last name *
          <input
            required
            type="text"
            className="signup__form-input signup__form-input_lastName input"
            onChange={handleChangeLastName}
            value={lastName}
          />
        </label>
        <label htmlFor="email" className="signup__form-label">
          Email *
          <input
            required
            type="email"
            className="signup__form-input signup__form-input_email input"
            onChange={handleChangeEmail}
            value={email}
          />
        </label>
        <label htmlFor="password" className="signup__form-label">
          Password *
          <input
            required
            type="password"
            className="signup__form-input signup__form-input_password input"
            onChange={handleChangePassword}
            value={password}
          />
        </label>
        <button type="submit" className="signup__form-submit-button button">
          Next
        </button>
        <Link className="signup__form-back-link" to="/">
          <button className="signup__form-back-button button">Back</button>
        </Link>
        <p className="signup__already-have-account">
          Already have an account?{" "}
          <Link className="signin__link" to="/signin">
            Login.
          </Link>
        </p>
      </form>
    </div>
  );
}
