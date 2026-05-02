import { useState } from "react";
import { useOnboarding } from "./OnboardingContext";
import "./OnboardingChecklist.css";

export default function OnboardingChecklist() {
  const {
    steps,
    completedSet,
    currentStep,
    isFirstWinComplete,
    completedStepIds,
  } = useOnboarding();

  const [isMinimized, setIsMinimized] = useState(() => {
    return localStorage.getItem("onboarding:checklistMinimized") === "true";
  });

  const [dismissedCompleteCard, setDismissedCompleteCard] = useState(() => {
    return localStorage.getItem("onboarding:firstWinCardDismissed") === "true";
  });

  function toggleMinimized() {
    const next = !isMinimized;
    localStorage.setItem("onboarding:checklistMinimized", String(next));
    setIsMinimized(next);
  }

  function closeCompleteCard() {
    localStorage.setItem("onboarding:firstWinCardDismissed", "true");
    setDismissedCompleteCard(true);
  }

  if (isFirstWinComplete && dismissedCompleteCard) {
    return null;
  }

  const completedCount = completedStepIds.length;
  const totalCount = steps.length;

  if (isMinimized) {
    return (
      <aside className="onboarding-popup onboarding-popup_minimized">
        <button
          type="button"
          className="onboarding-popup__minimized-button"
          onClick={toggleMinimized}
        >
          First quote: {completedCount}/{totalCount}
        </button>
      </aside>
    );
  }

  if (isFirstWinComplete) {
    return (
      <aside className="onboarding-popup onboarding-popup_complete">
        <div className="onboarding-popup__top">
          <div>
            <h3>First estimate completed 🎉</h3>
            <p>You created your first customer-ready estimate.</p>
          </div>

          <button
            type="button"
            className="onboarding-popup__icon-button"
            onClick={closeCompleteCard}
            aria-label="Close onboarding success message"
          >
            ×
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="onboarding-popup">
      <div className="onboarding-popup__top">
        <div>
          <h3>Get your first quote done</h3>
          <p>
            {currentStep
              ? `Next: ${currentStep.label}`
              : "You are almost done."}
          </p>
        </div>

        <button
          type="button"
          className="onboarding-popup__icon-button"
          onClick={toggleMinimized}
          aria-label="Minimize checklist"
        >
          —
        </button>
      </div>

      <div className="onboarding-popup__progress-row">
        <div className="onboarding-popup__bar">
          <div
            className="onboarding-popup__bar-fill"
            style={{
              width: `${Math.round((completedCount / totalCount) * 100)}%`,
            }}
          />
        </div>

        <span>
          {completedCount}/{totalCount}
        </span>
      </div>

      <ol className="onboarding-popup__list">
        {steps.map((step) => {
          const done = completedSet.has(step.id);
          const isCurrent = currentStep?.id === step.id;

          return (
            <li
              key={step.id}
              className={[
                "onboarding-popup__step",
                done ? "is-done" : "",
                isCurrent ? "is-current" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="onboarding-popup__check">
                {done ? "✓" : isCurrent ? "→" : "•"}
              </span>

              <span>{step.label}</span>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
