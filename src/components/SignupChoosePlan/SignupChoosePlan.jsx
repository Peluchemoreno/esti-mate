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
          <h3>Field Estimator Plan</h3>
          <p>14-day free trial, then $79.99/month</p>
          <small>
            Built for gutter contractors, sales reps, and estimators.
          </small>

          <ul>
            <li>Unlimited gutter estimates</li>
            <li>Jobsite diagram tool for gutters and downspouts</li>
            <li>Automatic footage and accessory calculations</li>
            <li>Miters, end caps, elbows, and offsets included</li>
            <li>Custom product pricing and colors</li>
            <li>Upload job photos and notes</li>
            <li>Professional PDF estimates for customers</li>
            <li>Save customers, projects, and past estimates</li>
            <li>Works on phone, tablet, and desktop</li>
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
