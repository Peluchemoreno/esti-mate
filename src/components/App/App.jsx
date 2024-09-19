import './App.css'
import LandingPage from '../LandingPage/LandingPage'
import Dashboard from '../Dashboard/Dashboard'
import Signin from '../Signin/Signin'
import Signup from '../Signup/Signup'
import PageNotFound from '../PageNotFound/PageNotFound'
import { Routes, Route } from 'react-router-dom'
import CurrentUserContext from '../../contexts/CurrentUserContext/CurrentUserContext'
import { useState } from 'react'
import {users} from '../../utils/constants'
import { useNavigate } from 'react-router-dom'
import Projects from '../Projects/Projects'
import Products from '../Products/Products'
import Settings from '../Settings/Settings'
import { useLocation } from 'react-router-dom'


function App() {

  const [currentUser, setCurrentUser] = useState({})
  const navigate = useNavigate()
  

  /* ------------------------------------------------------------------------------------ */
  /*                           this is the test for useLocation                           */
  /* ------------------------------------------------------------------------------------ */

  const location = useLocation()
  console.log(location)

  /* ------------------------------------------------------------------------------------ */
  /*                           this is the test for useLocation                           */
  /* ------------------------------------------------------------------------------------ */

  function handleLogin(email, password){
    if (users.some(user => {
      return user.email === email && user.password === password
    })){
      setCurrentUser({
        email,
        password,
      })
      navigate('/dashboard/projects')
      return
    } else {
      console.error('incorrect email or password')
    }
  }



  return (
    <>
      <div className="page">
        <CurrentUserContext.Provider value={currentUser}>
        <Routes>
          <Route path='*' element={<PageNotFound />} />
          <Route path='/esti-mate' element={<LandingPage />} />
          <Route path='/dashboard' element={<Dashboard />}>
            <Route path='projects' element={<Projects />}/>
            <Route path='products' element={<Products />}/>
            <Route path='settings' element={<Settings />}/>
          </Route>
          <Route path='/signin' element={<Signin handleLogin={handleLogin} />} />
          <Route path='/signup' element={<Signup />} />
        </Routes>
        </CurrentUserContext.Provider>
      </div>
    </>
  )
}

export default App
