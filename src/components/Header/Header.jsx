import './Header.css'
import logo from '../../assets/estimate-transparent-blue.png'

export default function Header(){
  return (
    <header className='header'>
      <img className='header__logo' src={logo} alt="esti-mate logo" />
      <nav className='header__navigation'>
        <ul className='header__navigation-list'>
          <li className='header__navigation-item'>Features</li>
          <li className='header__navigation-item'>Pricing</li>
          <li className='header__navigation-item'>Resources</li>
        </ul>
      </nav>
      <button className="header__button">Subscribe Now</button>

    </header>
  )
}