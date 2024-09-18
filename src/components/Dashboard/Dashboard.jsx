import './Dashboard.css'

export default function Dashboard({currentUser}){


  return (
    <div className="page">
      hello {currentUser.email}
    </div>
  )
}