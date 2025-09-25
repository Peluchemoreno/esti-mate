// src/components/BackButton/BackButton.jsx
import { useNavigate } from "react-router-dom";
import backArrow from "../../assets/icons/back.svg"; // same icon you use
import "./BackButton.css";

export default function BackButton({ className }) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(-1)}
      className={`back-button ${className || ""}`}
      aria-label="Go back"
    >
      <img style={{ marginRight: 5 }} src={backArrow} alt="Back" />
      Go Back
    </button>
  );
}
