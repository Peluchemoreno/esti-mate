import './App.css'
import LandingPage from '../LandingPage/LandingPage'
import Dashboard from '../Dashboard/Dashboard'
import Signin from '../Signin/Signin'
import Signup from '../Signup/Signup'
import PageNotFound from '../PageNotFound/PageNotFound'
import { Routes, Route } from 'react-router-dom'
import CurrentUserContext from '../../contexts/CurrentUserContext/CurrentUserContext'
import { useState, useEffect, act } from 'react'
import {users} from '../../utils/constants'
import {signin, getUser, createProject, getProjects} from '../../utils/auth'
import { useNavigate } from 'react-router-dom'
import Projects from '../Projects/Projects'
import Products from '../Products/Products'
import Settings from '../Settings/Settings'
import Project from '../Project/Project'
import Diagram from '../Diagram/Diagram'


function App() {

  const [currentUser, setCurrentUser] = useState({})
  const [activeModal, setActiveModal] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [projects, setProjects] = useState([])
  const navigate = useNavigate()

  

  useEffect(()=>{
    const token = localStorage.getItem('jwt')
    if (!token){
      return
    }
    getUser(token)
    .then(user => {
      setCurrentUser(user)
      getProjects(token).then(projectArray => {
        if (!projectArray){
          setProjects([])
          return 
        } else {
        const reverseOrderArray = projectArray.projects.reverse()
        setProjects([...reverseOrderArray])
        }
      })
    }).catch((err) => {
      console.error(err)
    })
  }, [])


  function handleLogin(email, password){
    signin(email, password)
    .then(data => {
      getUser(data.token)
      .then(user => {
        setCurrentUser(user)
        navigate('/dashboard/projects')
      })
    }).catch(err => {
      console.error(err)
    })
  }

  function handleLogOut(){
    localStorage.clear()
    setCurrentUser({})
  }

  function handleCreateProjectSubmit(projectData){
    const token = localStorage.getItem('jwt')
    createProject(projectData, token).
    then(data => {
      setProjects([data.data, ...projects])
    })
  }

  function closeModal(){
    setActiveModal('')
  }

  


  return (
    <>
      <div className="page">
        <CurrentUserContext.Provider value={currentUser}>
        <Routes>
          <Route path='*' element={<PageNotFound />} />
          <Route path='/esti-mate' element={<LandingPage />} />
          <Route path='/dashboard' element={<Dashboard handleLogOut={handleLogOut} />}>
            <Route path='projects' element={<Projects closeModal={closeModal} activeModal={activeModal} setActiveModal={setActiveModal} handleCreateProjectSubmit={handleCreateProjectSubmit} projects={projects} setProjects={setProjects}/>}/>
            <Route path='projects/:projectId' element={<Project activeModal={activeModal} setActiveModal={setActiveModal} projects={projects}/>} />
            <Route path='products' element={<Products />}/>
            <Route path='settings' element={<Settings />}/>
          </Route>
          <Route path='/signin' element={<Signin handleLogin={handleLogin} />} />
          <Route path='/signup' element={<Signup />} />
        </Routes>
        </CurrentUserContext.Provider>
        <Diagram activeModal={activeModal} closeModal={closeModal}/>
      </div>
    </>
  )
}

export default App