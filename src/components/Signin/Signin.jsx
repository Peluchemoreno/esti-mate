import './Signin.css'
import logo from '../../assets/estimate-nobackground-blue.png'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'

export default function Signin({handleLogin}){

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(()=>{
    resetInputs()
  }, [])

  function resetInputs(){
    setEmail('')
    setPassword('')
  }

  function handleLoginSubmit(e){
    e.preventDefault()
    handleLogin(email, password)
    resetInputs()
  }

  function handleEmailChange(e){
    setEmail(e.target.value)
  }

  function handlePasswordChange(e){
    setPassword(e.target.value)
  }

  return (
    <>
    <Link to='/'><img src={logo} alt="sign in header logo" className="signin__header-logo" /></Link>
    <div className="signin">
      <h2 className='signin__header'>Login to Esti-Mate</h2>
      <form onSubmit={handleLoginSubmit} className="signin-form">
        <label htmlFor="email" className="signin__form-label"><span className='signin__form-label-text'>Email</span>
          <input id='email' type="email" className="signin__form-input input" required onChange={handleEmailChange}/>
        </label>
        <label htmlFor="password" className="signin__form-label"><span className='signin__form-label-text'>Password</span>
          <input id='password' type="password" className="signin__form-input input" required minLength='8' onChange={handlePasswordChange}/>
        </label>
        <button type='submit' className="signin__button">Login</button>
      </form>
      <p className="signin__signup-or-forgot-password">Don&apos;t have an account? <Link className='signup-link' to='/signup'>Sign up</Link></p>
      <Link className='forgotpw-link' to='/'>Forgot password?</Link>
    </div>
    </>
  )
}