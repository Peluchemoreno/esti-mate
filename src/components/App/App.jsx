import './App.css'
import Header from '../Header/Header'
function App() {

  return (
    <>
      <div className="page">
        <Header />
        <section className="hero">
          <h1 className='hero__title'><span className="accent">Simplify</span> Your Quote Process</h1>
          <p className="hero__description">Seamlessly transform drawings into accurate gutter estimates, improving collaboration and communication at any time from any location.</p>
          <button className="hero__button">Subscribe Now</button>
        </section>
      </div>
    </>
  )
}

export default App
