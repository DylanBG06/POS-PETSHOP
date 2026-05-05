import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, User, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { authAPI } from '../services/api'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [cargando, setCargando] = useState(false)
  const navigate = useNavigate()

  // Si ya hay sesión, redirigir
  useEffect(() => {
    if (sessionStorage.getItem('pos_token')) {
      navigate('/ventas', { replace: true })
    }
  }, [navigate])

  const submit = async (e) => {
    e.preventDefault()
    if (!username.trim() || !password) {
      toast.error('Completá usuario y contraseña')
      return
    }

    setCargando(true)
    try {
      const data = await authAPI.login(username.trim(), password)
      sessionStorage.setItem('pos_token', data.access_token)
      sessionStorage.setItem('pos_usuario', JSON.stringify(data.usuario))
      toast.success(`Hola ${data.usuario.nombre_completo || data.usuario.username}`)
      navigate('/ventas', { replace: true })
    } catch (err) {
      toast.error(err.message || 'Error al iniciar sesión')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-slate-50 to-brand-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-600 rounded-2xl mb-3 shadow-lg shadow-brand-200">
            <span className="text-white font-bold text-2xl">M</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Mascotitas Felices</h1>
          <p className="text-sm text-slate-500 mt-1">Sistema de punto de venta</p>
        </div>

        <form onSubmit={submit} className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 p-6 space-y-4 border border-slate-100">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Usuario</label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="admin"
                autoComplete="username"
                autoFocus
                className="input-base w-full pl-9"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Contraseña</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="input-base w-full pl-9"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={cargando}
            className="btn-primary w-full py-3 text-base disabled:opacity-50"
          >
            {cargando ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div className="mt-4 text-xs text-center text-slate-500 flex items-center justify-center gap-2">
          <AlertCircle size={12} />
          <span>Si es la primera vez: usuario <code className="bg-slate-100 px-1.5 rounded">admin</code> · contraseña <code className="bg-slate-100 px-1.5 rounded">admin123</code></span>
        </div>
      </div>
    </div>
  )
}
