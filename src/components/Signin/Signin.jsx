import "./Signin.css";
import logo from "../../assets/estimate-nobackground-blue.png";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Loader from "../Loader/Loader";

export default function Signin({
  handleLogin,
  isLoading,
  isSignInErrorVisible,
  setIsSignInErrorVisible,
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigator = useNavigate();

  useEffect(() => {
    resetInputs();
  }, []);

  useEffect(() => {
    setIsSignInErrorVisible(false);
  }, []);

  /* This next line is commented out to prevent automatic sign-in due to stripe bypass bug storing jwt in localStorage without proper authentication */

  /* useEffect(() => {
    if (localStorage.jwt) {
      navigator("/dashboard/projects");
    }
  }); */

  function resetInputs() {
    setEmail("");
    setPassword("");
  }

  function handleLoginSubmit(e) {
    e.preventDefault();
    handleLogin(email, password);
  }

  function handleEmailChange(e) {
    setEmail(e.target.value);
  }

  function handlePasswordChange(e) {
    setPassword(e.target.value);
  }

  return (
    <>
      <Link to="/">
        <img
          src={logo}
          alt="sign in header logo"
          className="signin__header-logo"
        />
      </Link>
      <div className="signin">
        <h2 className="signin__header">Login to Esti-Mate</h2>
        <form onSubmit={handleLoginSubmit} className="signin-form">
          <label htmlFor="email" className="signin__form-label">
            <span className="signin__form-label-text">Email</span>
            <input
              id="email"
              type="email"
              className="signin__form-input input"
              required
              onChange={handleEmailChange}
            />
          </label>
          <label htmlFor="password" className="signin__form-label">
            <span className="signin__form-label-text">Password</span>
            <input
              id="password"
              type="password"
              className="signin__form-input input"
              required
              minLength="0"
              onChange={handlePasswordChange}
            />
          </label>
          {isSignInErrorVisible && (
            <p className="signin__error-message">
              Incorrect email or password.
            </p>
          )}

          <button type="submit" className="signin__button">
            {isLoading ? <Loader /> : "Login"}
          </button>
        </form>
        <p
          className="signin__signup-or-forgot-password"
          style={{ marginBottom: 10 }}
        >
          Don&apos;t have an account?{" "}
          <Link className="signup-link" to="/signup">
            Sign up.
          </Link>
        </p>
        {/*         <p className="signin__signup-or-forgot-password">
          {" "}
          Forgot password? Contact support at contact.esti.mate@gmail.com{" "}
        </p> */}
        Forgot password?
        <a href="mailto:contact.esti.mate@gmail.com">
          {" "}
          Contact us at contact.esti.mate@gmail.com
        </a>
        {/* <Link className="forgotpw-link" to="/esti-mate">
          Forgot password?
        </Link> */}
      </div>
    </>
  );
}
