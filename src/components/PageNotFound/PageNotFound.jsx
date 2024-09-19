import './PageNotFound.css'
import { useLocation } from 'react-router-dom'

export default function PageNotFound(){

  const location = useLocation()
  console.log(location)

  return (
    <div className="page-not-found">
      this page is not found
    </div>
  )
}