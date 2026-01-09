// src/components/SignupChoosePlan/SignupChoosePlan.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import BackButton from "../BackButton/BackButton";
import "./SignupChoosePlan.css";

export default function SignupPlans() {
  const [plan, setPlan] = useState(null);
  const navigate = useNavigate();

  const choose = (p) => {
    setPlan(p);
    // ✅ Go to dedicated checkout route so chooser unmounts first
    navigate(`/checkout/embedded?plan=${p}`);
  };

  return (
    <div className="signup-choose-plan">
      <h2>Choose Your Plan</h2>
      <div className="plans">
        <div className="plan" onClick={() => choose("basic")}>
          <h3>Basic Estimate Package</h3>
          <p>$79.99/month</p>
          <ul>
            <li>Basic features</li>
            <li>Unlimited projects</li>
            <li>Email support</li>
          </ul>
        </div>

        <div
          style={{
            width: "10px",
            height: "10px",
            position: "absolute",
            top: "0px",
            left: "0px",
            overflow: "hidden",
            zIndex: 10000,
            cursor: "pointer",
            display: "none",
            /* hide this from regular users */
          }}
          onClick={() => choose("test")}
        >
          <h3>Test Estimate Package</h3>
          <p>$0.01/month</p>
          <ul>
            <li>All Basic Plan features</li>
            <li>Unlimited projects</li>
            <li>Priority email support</li>
          </ul>
        </div>
      </div>
      <BackButton />
    </div>
  );
}
