import "./Signin.css";
import logo from "../../assets/estimate-nobackground-blue.png";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

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

  useEffect(() => {
    if (localStorage.jwt) {
      navigator("/dashboard/projects");
    }
  });
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
      <Link to="/esti-mate">
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
            {isLoading ? (
              <div className="signin__preloader-container">
                <div className="ball ball1"></div>
                <div className="ball ball2"></div>
                <div className="ball ball3"></div>
                <div className="ball ball4"></div>
              </div>
            ) : (
              "Login"
            )}
          </button>
        </form>
        <p className="signin__signup-or-forgot-password">
          Don&apos;t have an account?{" "}
          <Link className="signup-link" to="/signup">
            Sign up.
          </Link>
        </p>
        <Link className="forgotpw-link" to="/esti-mate">
          Forgot password?
        </Link>
      </div>
    </>
  );
}
