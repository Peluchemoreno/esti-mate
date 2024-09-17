import './App.css'
import LandingPage from '../LandingPage/LandingPage'
import Dashboard from '../Dashboard/Dashboard'
import Signin from '../Signin/Signin'
import Signup from '../Signup/Signup'
import PageNotFound from '../PageNotFound/PageNotFound'
import { Routes, Route } from 'react-router-dom'
function App() {

  return (
    <>
      <div className="page">
        <Routes>
          <Route path='*' element={<PageNotFound />} />
          <Route path='/' element={<LandingPage />} />
          <Route path='/dashboard' element={<Dashboard />} />
          <Route path='/signin' element={<Signin />} />
          <Route path='/signup' element={<Signup />} />
        </Routes>
      </div>
    </>
  )
}

export default App
