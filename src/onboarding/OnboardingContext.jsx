import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  getUser,
  trackOnboardingEvent as trackOnboardingEventApi,
} from "../utils/auth";
import {
  FIRST_ESTIMATE_STEPS,
  getFirstIncompleteStep,
} from "./onboardingFlows";

const OnboardingContext = createContext(null);

export function OnboardingProvider({ currentUser, setCurrentUser, children }) {
  const [isTracking, setIsTracking] = useState(false);

  const onboarding = currentUser?.onboarding || {};
  const completedStepIds = Array.isArray(onboarding.completedStepIds)
    ? onboarding.completedStepIds
    : [];

  const completedSet = useMemo(
    () => new Set(completedStepIds),
    [completedStepIds],
  );

  const currentStep = useMemo(
    () => getFirstIncompleteStep(completedStepIds),
    [completedStepIds],
  );

  const isFirstWinComplete = Boolean(onboarding.firstWinCompletedAt);

  const track = useCallback(
    async (eventName, metadata = {}) => {
      const token = localStorage.getItem("jwt");
      if (!token || !eventName) return null;

      setIsTracking(true);

      try {
        const res = await trackOnboardingEventApi(eventName, metadata, token);

        // Fast local update from tracking response
        if (res?.onboarding) {
          setCurrentUser((prev) => ({
            ...(prev || {}),
            onboarding: res.onboarding,
          }));
        } else {
          // Fallback: refresh full user
          const freshUser = await getUser(token);
          setCurrentUser(freshUser);
        }

        return res;
      } catch (err) {
        console.warn("Onboarding tracking failed:", err);
        return null;
      } finally {
        setIsTracking(false);
      }
    },
    [setCurrentUser],
  );

  const value = {
    steps: FIRST_ESTIMATE_STEPS,
    onboarding,
    completedStepIds,
    completedSet,
    currentStep,
    isFirstWinComplete,
    isTracking,
    track,
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);

  if (!ctx) {
    throw new Error("useOnboarding must be used inside OnboardingProvider");
  }

  return ctx;
}
