import { NavLink, useNavigate } from 'react-router-dom'
import { ShoppingCart, Package, Wallet, BarChart3, PackagePlus, Settings, LogOut, User } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import { configAPI } from '../services/api'

const links = [
  { to: '/ventas',       label: 'Ventas',       icon: ShoppingCart },
  { to: '/inventario',   label: 'Inventario',   icon: Package },
  { to: '/caja',         label: 'Caja',         icon: Wallet },
  { to: '/reportes',     label: 'Reportes',     icon: BarChart3 },
  { to: '/ingresos',     label: 'Ingresos',     icon: PackagePlus },
  { to: '/configuracion',label: 'Configuración',icon: Settings },
]

export default function Layout({ children }) {
  const [nombreNegocio, setNombreNegocio] = useState('Mi Tienda')
  const [hora, setHora] = useState(new Date())
  const [menuAbierto, setMenuAbierto] = useState(false)
  const navigate = useNavigate()
  const menuRef = useRef(null)

  const usuario = JSON.parse(sessionStorage.getItem('pos_usuario') || '{}')

  useEffect(() => {
    configAPI.obtener('nombre_negocio').then(c => {
      if (c.valor) setNombreNegocio(c.valor)
    }).catch(() => {})

    const t = setInterval(() => setHora(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuAbierto(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const cerrarSesion = () => {
    if (confirm('¿Cerrar sesión?')) {
      sessionStorage.removeItem('pos_token')
      sessionStorage.removeItem('pos_usuario')
      navigate('/login', { replace: true })
    }
  }

  const fechaStr = hora.toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' })
  const horaStr = hora.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">M</div>
              <div className="font-semibold text-slate-800">{nombreNegocio}</div>
            </div>

            <nav className="flex items-center gap-1">
              {links.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-brand-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`
                  }
                >
                  <Icon size={16} />
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-xs text-slate-500 tabular-nums">
              {fechaStr} · {horaStr}
            </div>

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuAbierto(!menuAbierto)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div className="w-7 h-7 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center text-xs font-semibold">
                  {(usuario.nombre_completo || usuario.username || '?').charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-slate-700">{usuario.username || ''}</span>
              </button>

              {menuAbierto && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden animate-fade-in">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <div className="text-xs text-slate-500">Conectado como</div>
                    <div className="text-sm font-medium">{usuario.nombre_completo || usuario.username}</div>
                  </div>
                  <button
                    onClick={() => { setMenuAbierto(false); navigate('/configuracion') }}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-slate-50 flex items-center gap-2"
                  >
                    <User size={14} /> Mi cuenta
                  </button>
                  <button
                    onClick={cerrarSesion}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-red-50 text-red-600 flex items-center gap-2 border-t border-slate-100"
                  >
                    <LogOut size={14} /> Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-[1600px] mx-auto">
        {children}
      </main>
    </div>
  )
}
