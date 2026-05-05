import { Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { authAPI } from '../services/api'

export default function ProtectedRoute({ children }) {
  const [estado, setEstado] = useState('verificando') // verificando | ok | invalido
  const location = useLocation()

  useEffect(() => {
    const token = sessionStorage.getItem('pos_token')
    if (!token) {
      setEstado('invalido')
      return
    }
    // Validar que el token siga siendo válido
    authAPI.yo()
      .then(() => setEstado('ok'))
      .catch(() => {
        sessionStorage.removeItem('pos_token')
        sessionStorage.removeItem('pos_usuario')
        setEstado('invalido')
      })
  }, [])

  if (estado === 'verificando') {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        Verificando sesión...
      </div>
    )
  }

  if (estado === 'invalido') {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}
