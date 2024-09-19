import './PageNotFound.css'
import { useNavigation } from 'react-router-dom'

export default function PageNotFound(){

  const navigation = useNavigation()
  console.log(navigation)

  return (
    <div className="page-not-found">
      this page is not found {navigation}
    </div>
  )
}