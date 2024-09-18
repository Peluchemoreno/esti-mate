import './Signup.css'
import logo from '../../assets/estimate-nobackground-blue.png'
import { Link } from 'react-router-dom'

export default function Signup(){

  function handleSignup(e){
    e.preventDefault();
    console.log('signing up')
  }

  return (
    <div className="signup">
      <Link className='signup__logo-link' to='/'><img src={logo} alt="signup logo" className="signup__logo" /></Link>
      <form onSubmit={handleSignup} className="signup__form">
        <h2 className="signup__header">Sign up for Esti-Mate</h2>
        <label htmlFor="firstName" className="signup__form-label">First name *
          <input required type="text" className="signup__form-input signup__form-input_firstName input" />
        </label>
        <label htmlFor="lastName" className="signup__form-label">Last name *
          <input required type="text" className="signup__form-input signup__form-input_lastName input" />
        </label>
        <label htmlFor="email" className="signup__form-label">Email *
          <input required type="email" className="signup__form-input signup__form-input_email input" />
        </label>
        <label htmlFor="password" className="signup__form-label">Password *
          <input required type="password" className="signup__form-input signup__form-input_password input" />
        </label>
        <button type='submit' className="signup__form-submit-button button">Sign up</button>
        <Link className='signup__form-back-link' to='/'><button className="signup__form-back-button button">Back</button></Link>
        <p className="signup__already-have-account">Already have an account? <Link className='signin__link' to='/signin'>Login</Link></p>
      </form>
    </div>
  )
}