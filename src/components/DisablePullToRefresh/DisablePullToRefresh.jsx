import { useEffect } from "react";

function DisablePullToRefresh() {


  useEffect(() => {
    const preventPullToRefresh = (e) => {
      if (window.scrollY === 0) {
        e.preventDefault();
      }
    };

    document.addEventListener("touchstart", preventPullToRefresh, { passive: false });
    document.addEventListener("touchmove", preventPullToRefresh, { passive: false });

    return () => {
      document.removeEventListener("touchstart", preventPullToRefresh);
      document.removeEventListener("touchmove", preventPullToRefresh);
    };
  }, []);

  return null; // Since this is a utility effect, it renders nothing
};

export default DisablePullToRefresh;

// import { useEffect } from "react";

// function DisableScroll() {
//   useEffect(() => {
//     let initialY = null;

//     const preventScroll = (e) => {
//       if (e.touches && e.touches.length === 1) {
//         const touch = e.touches[0];
//         if (initialY === null) {
//           initialY = touch.clientY;
//         } else {
//           // Block scrolling both up and down
//           const deltaY = touch.clientY - initialY;

//           if (window.scrollY === 0 && deltaY > 0) {
//             // Prevent pull-to-refresh (scrolling up at the top)
//             e.preventDefault();
//           } else if (window.scrollY + window.innerHeight >= document.body.scrollHeight && deltaY < 0) {
//             // Prevent scrolling down when at the bottom of the page
//             e.preventDefault();
//           }
//         }
//       }
//     };

//     const resetInitialY = () => {
//       initialY = null;
//     };

//     document.addEventListener("touchstart", resetInitialY, { passive: true });
//     document.addEventListener("touchmove", preventScroll, { passive: false });

//     return () => {
//       document.removeEventListener("touchstart", resetInitialY);
//       document.removeEventListener("touchmove", preventScroll);
//     };
//   }, []);

//   return null;
// }

// export default DisableScroll;

