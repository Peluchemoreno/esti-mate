import "./App.css";
import LandingPage from "../LandingPage/LandingPage";
import Dashboard from "../Dashboard/Dashboard";
import Signin from "../Signin/Signin";
import Signup from "../Signup/Signup";
import PageNotFound from "../PageNotFound/PageNotFound";
import { Routes, Route } from "react-router-dom";
import CurrentUserContext from "../../contexts/CurrentUserContext/CurrentUserContext";
import { useState, useEffect, act } from "react";
import { signin, getUser, createProject, getProjects } from "../../utils/auth";
// import { createProject, getProjects } from "../../utils/api";
import { useNavigate } from "react-router-dom";
import Projects from "../Projects/Projects";
import Products from "../Products/Products";
import Settings from "../Settings/Settings";
import Project from "../Project/Project";
import Diagram from "../Diagram/Diagram";
import DisablePullToRefresh from "../DisablePullToRefresh/DisablePullToRefresh";
import { addDiagramToProject, getProducts } from "../../utils/api";

function App() {
  const [currentUser, setCurrentUser] = useState({});
  const [activeModal, setActiveModal] = useState("");
  const [currentProjectId, setCurrentProjectId] = useState("");
  const [projects, setProjects] = useState([]);
  const navigate = useNavigate();
  const [mobileDiagramActive, setMobileDiagramActive] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 650);
  const [projectDiagrams, setProjectDiagrams] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem("jwt");
    if (!token) {
      return;
    }
    getUser(token)
      .then((user) => {
        setCurrentUser(user);
        getProjects(token).then((projectArray) => {
          if (!projectArray) {
            setProjects([]);
            return;
          } else {
            const reverseOrderArray = projectArray.projects.reverse();
            setProjects([...reverseOrderArray]);
            console.log(projectArray.projects);
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

  function handleAddDiagramToProject(data) {
    // addDiagramToProject(projectId, token, data);
    return data;
  }

  function closeModal() {
    setActiveModal("");
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
                    projectDiagrams={projectDiagrams}
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
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route
              path="/signin"
              element={<Signin handleLogin={handleLogin} />}
            />
            <Route path="/signup" element={<Signup />} />
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
              />
            </>
          ) : (
            <Diagram
              activeModal={activeModal}
              closeModal={closeModal}
              isMobile={isMobile}
              currentProjectId={currentProjectId}
            />
          )}
        </>
      </div>
    </>
  );
}

export default App;
