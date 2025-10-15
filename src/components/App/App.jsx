import "./App.css";
import "../../shims/buffer";
import LandingPage from "../LandingPage/LandingPage";
import CheckoutReturn from "../Stripe/CheckoutReturn";
import Stripe from "../Stripe/Stripe";
import Dashboard from "../Dashboard/Dashboard";
import Signin from "../Signin/Signin";
import Signup from "../Signup/Signup";
import PageNotFound from "../PageNotFound/PageNotFound";
import { Routes, Route } from "react-router-dom";
import CurrentUserContext from "../../contexts/CurrentUserContext/CurrentUserContext";
import { useState, useEffect, useCallback } from "react";
import { ProductsProvider } from "../../contexts/ProductsContext";
import { useSearchParams } from "react-router-dom";
import { useLocation } from "react-router-dom";
import {
  signin,
  getUser,
  createProject,
  getProjects,
  uploadLogo,
  signUp,
} from "../../utils/auth";
import { useNavigate } from "react-router-dom";
import Projects from "../Projects/Projects";
import Products from "../Products/Products";
import Settings from "../Settings/Settings";
import Project from "../Project/Project";
import Diagram from "../Diagram/Diagram";
import DisablePullToRefresh from "../DisablePullToRefresh/DisablePullToRefresh";
import SignupContinued from "../SignupContinued/SignupContinued";
import {
  updateDiagram,
  createProduct,
  addDiagramToProject,
} from "../../utils/api";
import SignupChoosePlan from "../SignupChoosePlan/SignupChoosePlan";

function App() {
  const [tempUserData, setTempUserData] = useState({});
  const [tempLogo, setTempLogo] = useState(null);
  const [currentUser, setCurrentUser] = useState({});
  const [activeModal, setActiveModal] = useState("");
  const [currentProjectId, setCurrentProjectId] = useState("");
  const [projects, setProjects] = useState([]);
  const navigate = useNavigate();
  const [mobileDiagramActive, setMobileDiagramActive] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 650);
  const [diagrams, setDiagrams] = useState([]);
  const [selectedDiagram, setSelectedDiagram] = useState({});
  const [originalDiagram, setOriginalDiagram] = useState({});
  const [currentDiagram, setCurrentDiagram] = useState({});
  const [userData, setUserData] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSignInErrorVisible, setIsSignInErrorVisible] = useState(false);
  const [authState, setAuthState] = useState({
    token: localStorage.getItem("jwt") || null,
  });
  const location = useLocation();
  const showDiagram = location.pathname.startsWith("/dashboard");

  useEffect(() => {
    const onStorage = () => {
      setAuthState((s) => ({
        ...s,
        token: localStorage.getItem("jwt") || null,
      }));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("jwt");
    if (!token) {
      return;
    }
    getUser(token)
      .then((user) => {
        setCurrentUser(user);
        localStorage.setItem("currentUserId", user._id);
        getProjects(token).then((projectArray) => {
          if (!projectArray) {
            setProjects([]);
            return;
          } else {
            const reverseOrderArray = projectArray.projects.reverse();
            setProjects([...reverseOrderArray]);
          }
        });
      })
      .catch((err) => {
        console.error(err);
      });
  }, []);

  function BillingCancelled() {
    return (
      <div style={{ padding: 20 }}>
        <h1>Payment Cancelled</h1>
        <a href="/dashboard/projects">Return to projects</a>
      </div>
    );
  }

  function BillingSuccess() {
    const [params] = useSearchParams();
    const sessionId = params.get("session_id");

    return (
      <div style={{ padding: 20 }}>
        <h1>Payment Successful 🎉 Enjoy using Esti-Mate</h1>
        <a href="/dashboard/projects">Go back to projects</a>
      </div>
    );
  }

  // App.jsx — handleLogin
  function handleLogin(email, password) {
    setIsLoading(true);
    signin(email, password)
      .then((data) => {
        const token = data.token;
        localStorage.setItem("jwt", token);
        setAuthState({ token }); // <-- FIX
        return getUser(token);
      })
      .then((user) => {
        setCurrentUser(user);
        localStorage.setItem("currentUserId", user._id);
        navigate("/dashboard/projects");
      })
      .catch((err) => {
        setIsSignInErrorVisible(true);
        console.error(err);
      })
      .finally(() => setIsLoading(false));
  }

  // App.jsx — handleSignUp
  // App.jsx — replace handleSignUp with this version
  // App.jsx — replace handleSignUp with this version
  function handleSignUp(userData, logo) {
    setIsLoading(true);
    const { email, password } = userData;

    // helper: try sign in
    const doSignin = () =>
      signin(email, password).then((data) => {
        const token = data.token;
        if (!token) throw new Error("No token from signin");
        localStorage.setItem("jwt", token);
        setAuthState({ token });
        return token;
      });

    signUp(userData)
      .then(() => doSignin())
      .catch(async (err) => {
        // If email already exists, try to sign in instead of bailing
        const msg = (err?.message || "").toLowerCase();
        const isDup =
          err?.status === 409 ||
          msg.includes("duplicate") ||
          msg.includes("exists") ||
          msg.includes("already");
        if (isDup) {
          return doSignin(); // proceed by signing in
        }
        throw err; // real error → surface it
      })
      .then(async (token) => {
        // upload logo if present (ignore errors)
        if (logo) {
          try {
            await uploadLogo(logo, token);
          } catch {}
        }
        // fetch user and store
        const user = await getUser(token);
        setCurrentUser(user);
        localStorage.setItem("currentUserId", user._id);

        // ✅ only now that we have a JWT go to plan selection
        navigate("/signup/cont/stripe", { replace: true });
      })
      .catch((err) => {
        console.error("Signup flow failed:", err);
        // show some UI error if you want
      })
      .finally(() => setIsLoading(false));
  }

  function handleLogOut() {
    localStorage.clear();
    setCurrentUser({});
  }

  function handleCreateProjectSubmit(projectData) {
    const token = localStorage.getItem("jwt");
    createProject(projectData, token).then((data) => {
      setProjects([data.data, ...projects]);
    });
  }

  function closeModal() {
    // Only nuke selection when the diagram modal is closing
    if (activeModal === "confirmDiagramOverwrite") {
      setSelectedDiagram({}); // <-- clear Project page selection
      setCurrentDiagram({}); // <-- clear editor diagram
      setOriginalDiagram({}); // optional: keeps your diff/overwrite logic clean
      setMobileDiagramActive(false); // if you use the mobile editor
    }
    setActiveModal("");
  }

  function handlePassDiagramData(data) {
    setDiagrams((prevDiagrams) => [...prevDiagrams, data]);
  }

  function handleEditDiagram(diagram) {
    // setSelectedDiagram(diagram);
    setCurrentDiagram(diagram);
    setOriginalDiagram(diagram);
  }

  function continueSignup(data) {
    setUserData(data);
  }

  return (
    <CurrentUserContext.Provider value={currentUser}>
      <ProductsProvider>
        <>
          <div className="page">
            <Routes>
              <Route path="*" element={<PageNotFound />} />
              <Route path="/" element={<LandingPage />} />
              <Route
                path="/dashboard"
                element={<Dashboard handleLogOut={handleLogOut} />}
              >
                <Route
                  path="projects"
                  element={
                    <Projects
                      closeModal={closeModal}
                      activeModal={activeModal}
                      setActiveModal={setActiveModal}
                      handleCreateProjectSubmit={handleCreateProjectSubmit}
                      projects={projects}
                      setProjects={setProjects}
                    />
                  }
                />
                <Route
                  path="projects/:projectId"
                  element={
                    <Project
                      activeModal={activeModal}
                      setActiveModal={setActiveModal}
                      projects={projects}
                      setMobileDiagramActive={setMobileDiagramActive}
                      isMobile={isMobile}
                      setCurrentProjectId={setCurrentProjectId}
                      diagrams={diagrams} // Pass diagrams state as a prop
                      setDiagrams={setDiagrams} // Pass setDiagrams to allow updates
                      handleEditDiagram={handleEditDiagram}
                      closeModal={closeModal}
                      currentDiagram={currentDiagram}
                      currentUser={currentUser}
                      setSelectedDiagram={setSelectedDiagram}
                      selectedDiagram={selectedDiagram}
                    />
                  }
                />

                <Route
                  path="products"
                  element={
                    <Products
                      activeModal={activeModal}
                      setActiveModal={setActiveModal}
                      closeModal={closeModal}
                    />
                  }
                />
                <Route
                  path="settings"
                  element={
                    <Settings
                      currentUser={currentUser}
                      setCurrentUser={setCurrentUser}
                    />
                  }
                />
              </Route>
              <Route
                path="/signin"
                element={
                  <Signin
                    handleLogin={handleLogin}
                    isLoading={isLoading}
                    isSignInErrorVisible={isSignInErrorVisible}
                    setIsSignInErrorVisible={setIsSignInErrorVisible}
                  />
                }
              />
              <Route
                path="/signup"
                element={<Signup handleSignupContinue={continueSignup} />}
              />
              <Route
                path="/signup/cont"
                element={
                  <SignupContinued
                    userData={userData}
                    setUserData={setUserData}
                    handleLogin={handleLogin}
                    handleSignUp={handleSignUp}
                    setTempUserData={setTempUserData}
                    setTempLogo={setTempLogo}
                    isLoading={isLoading}
                  />
                }
              />
              <Route
                path="/signup/cont/stripe"
                element={
                  <SignupChoosePlan
                    tempLogo={tempLogo}
                    tempUserData={tempUserData}
                  />
                }
              />
              <Route path="/checkout/return" element={<CheckoutReturn />} />
              <Route
                path="/checkout/embedded"
                element={
                  <Stripe
                    token={authState.token || localStorage.getItem("jwt")}
                  />
                }
              />
              <Route path="/billing/success" element={<BillingSuccess />} />
              <Route path="/billing/cancelled" element={<BillingCancelled />} />
            </Routes>
            {showDiagram && (
              <>
                {mobileDiagramActive ? (
                  <>
                    <DisablePullToRefresh />
                    <Diagram
                      activeModal={activeModal}
                      closeModal={closeModal}
                      isMobile={isMobile}
                      currentProjectId={currentProjectId}
                      updateDiagram={updateDiagram}
                      addDiagramToProject={addDiagramToProject}
                      handlePassDiagramData={handlePassDiagramData}
                      selectedDiagram={currentDiagram}
                      originalDiagram={originalDiagram}
                      setSelectedDiagram={setCurrentDiagram}
                      setActiveModal={setActiveModal}
                      diagrams={diagrams}
                    />
                  </>
                ) : (
                  <Diagram
                    activeModal={activeModal}
                    closeModal={closeModal}
                    isMobile={isMobile}
                    currentProjectId={currentProjectId}
                    updateDiagram={updateDiagram}
                    addDiagramToProject={addDiagramToProject}
                    handlePassDiagramData={handlePassDiagramData}
                    selectedDiagram={currentDiagram}
                    setSelectedDiagram={setCurrentDiagram}
                    originalDiagram={originalDiagram}
                    setActiveModal={setActiveModal}
                    diagrams={diagrams}
                  />
                )}
              </>
            )}
          </div>
        </>
      </ProductsProvider>
    </CurrentUserContext.Provider>
  );
}

export default App;
