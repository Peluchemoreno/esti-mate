import { useEffect } from "react";

function DisablePullToRefresh() {


  useEffect(() => {
    const preventPullToRefresh = (e) => {
      if (window.scrollY === 0) {
        e.preventDefault();
      }
    };

    // document.addEventListener("touchstart", preventPullToRefresh, { passive: false });
    document.addEventListener("touchmove", preventPullToRefresh, { passive: false });

    return () => {
      // document.removeEventListener("touchstart", preventPullToRefresh);
      document.removeEventListener("touchmove", preventPullToRefresh);
    };
  }, []);

  return null; // Since this is a utility effect, it renders nothing
};

export default DisablePullToRefresh;

