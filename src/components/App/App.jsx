import "./App.css";
import LandingPage from "../LandingPage/LandingPage";
import Dashboard from "../Dashboard/Dashboard";
import Signin from "../Signin/Signin";
import Signup from "../Signup/Signup";
import PageNotFound from "../PageNotFound/PageNotFound";
import { Routes, Route } from "react-router-dom";
import CurrentUserContext from "../../contexts/CurrentUserContext/CurrentUserContext";
import { useState, useEffect } from "react";
import {
  signin,
  getUser,
  createProject,
  getProjects,
  uploadLogo,
  signUp,
} from "../../utils/auth";
import { starterItems } from "../../utils/constants";
import { useNavigate } from "react-router-dom";
import Projects from "../Projects/Projects";
import Products from "../Products/Products";
import Settings from "../Settings/Settings";
import Project from "../Project/Project";
import Diagram from "../Diagram/Diagram";
import DisablePullToRefresh from "../DisablePullToRefresh/DisablePullToRefresh";
import SignupContinued from "../SignupContinued/SignupContinued";
import Estimates from "../Estimates/Estimates.jsx";
import { addDiagramToProject, createProduct } from "../../utils/api";

function App() {
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

  function handleLogin(email, password) {
    signin(email, password)
      .then((data) => {
        const token = data.token;
        getUser(token).then((user) => {
          setCurrentUser(user);
          navigate("/dashboard/projects");
        });
      })
      .catch((err) => {
        console.error(err);
      });
  }

  function handleSignUp(userData, logo) {
    const { email, password } = userData;

    signUp(userData).then(() => {
      signin(email, password).then((data) => {
        const token = data.token;
        uploadLogo(logo, token);
        starterItems.forEach((item) => {
          console.log(
            "creating item: ",
            item,
            " with description: ",
            item.description,
          );
          createProduct(item, token);
        });
        getUser(token).then((user) => {
          setCurrentUser(user);
          localStorage.setItem("userId", user._id);
          navigate("/dashboard/projects");
        });
      });
    });
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
    setCurrentDiagram({});
    setActiveModal("");
  }

  function handlePassDiagramData(data) {
    console.log(data);
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
    <>
      <div className="page">
        <CurrentUserContext.Provider value={currentUser}>
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
              <Route path="estimates" element={<Estimates />} />
            </Route>
            <Route
              path="/signin"
              element={<Signin handleLogin={handleLogin} />}
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
                />
              }
            />
          </Routes>
        </CurrentUserContext.Provider>
        <>
          {mobileDiagramActive ? (
            <>
              <DisablePullToRefresh />
              <Diagram
                activeModal={activeModal}
                closeModal={closeModal}
                isMobile={isMobile}
                currentProjectId={currentProjectId}
                addDiagramToProject={addDiagramToProject}
                setDiagrams={setDiagrams}
                handlePassDiagramData={handlePassDiagramData}
                selectedDiagram={currentDiagram}
                originalDiagram={originalDiagram}
                setSelectedDiagram={setCurrentDiagram}
                setActiveModal={setActiveModal}
              />
            </>
          ) : (
            <Diagram
              activeModal={activeModal}
              closeModal={closeModal}
              isMobile={isMobile}
              currentProjectId={currentProjectId}
              addDiagramToProject={addDiagramToProject}
              setDiagrams={setDiagrams}
              handlePassDiagramData={handlePassDiagramData}
              selectedDiagram={currentDiagram}
              setSelectedDiagram={setCurrentDiagram}
              originalDiagram={originalDiagram}
              setActiveModal={setActiveModal}
            />
          )}
        </>
      </div>
    </>
  );
}

export default App;
