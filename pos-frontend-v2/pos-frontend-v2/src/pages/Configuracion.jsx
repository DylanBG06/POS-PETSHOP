import { useEffect, useState } from 'react'
import { Save, Plus, Trash2, Lock, Building, Tag, Shield, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { configAPI, categoriasAPI, authAPI } from '../services/api'

export default function Configuracion() {
  const [seccion, setSeccion] = useState('negocio')

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
      {/* Navegación lateral */}
      <div className="card p-2 h-fit">
        <NavBtn icon={Building} label="Datos del negocio" active={seccion === 'negocio'} onClick={() => setSeccion('negocio')} />
        <NavBtn icon={Tag} label="Categorías" active={seccion === 'categorias'} onClick={() => setSeccion('categorias')} />
        <NavBtn icon={Lock} label="Mi cuenta" active={seccion === 'cuenta'} onClick={() => setSeccion('cuenta')} />
        <NavBtn icon={Shield} label="Sistema" active={seccion === 'sistema'} onClick={() => setSeccion('sistema')} />
      </div>

      <div>
        {seccion === 'negocio' && <SeccionNegocio />}
        {seccion === 'categorias' && <SeccionCategorias />}
        {seccion === 'cuenta' && <SeccionCuenta />}
        {seccion === 'sistema' && <SeccionSistema />}
      </div>
    </div>
  )
}

function NavBtn({ icon: Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
        active
          ? 'bg-brand-600 text-white'
          : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <Icon size={14} /> {label}
    </button>
  )
}

// ---------- DATOS DEL NEGOCIO ----------
function SeccionNegocio() {
  const [datos, setDatos] = useState({
    nombre_negocio: '',
    direccion: '',
    telefono: '',
    cedula_juridica: '',
  })
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    configAPI.listar().then(items => {
      const obj = {}
      items.forEach(i => obj[i.clave] = i.valor)
      setDatos(prev => ({ ...prev, ...obj }))
    }).catch(() => {})
  }, [])

  const guardar = async () => {
    setGuardando(true)
    try {
      for (const [clave, valor] of Object.entries(datos)) {
        await configAPI.actualizar(clave, valor || '')
      }
      toast.success('Datos guardados')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Datos del negocio</h2>
        <p className="text-xs text-slate-500 mt-1">Aparecerán en los recibos y reportes</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Nombre del negocio">
          <input
            type="text"
            value={datos.nombre_negocio || ''}
            onChange={e => setDatos({ ...datos, nombre_negocio: e.target.value })}
            placeholder="Mascotitas Felices"
            className="input-base w-full"
          />
        </Field>
        <Field label="Cédula jurídica">
          <input
            type="text"
            value={datos.cedula_juridica || ''}
            onChange={e => setDatos({ ...datos, cedula_juridica: e.target.value })}
            className="input-base w-full"
          />
        </Field>
        <Field label="Teléfono">
          <input
            type="tel"
            value={datos.telefono || ''}
            onChange={e => setDatos({ ...datos, telefono: e.target.value })}
            className="input-base w-full"
          />
        </Field>
        <Field label="Dirección">
          <input
            type="text"
            value={datos.direccion || ''}
            onChange={e => setDatos({ ...datos, direccion: e.target.value })}
            className="input-base w-full"
          />
        </Field>
      </div>

      <div className="flex justify-end pt-2">
        <button onClick={guardar} disabled={guardando} className="btn-primary flex items-center gap-2">
          <Save size={14} /> {guardando ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}

// ---------- CATEGORIAS ----------
function SeccionCategorias() {
  const [categorias, setCategorias] = useState([])
  const [nuevaCategoria, setNuevaCategoria] = useState('')

  const cargar = () => categoriasAPI.listar().then(setCategorias)

  useEffect(() => { cargar() }, [])

  const agregar = async () => {
    if (!nuevaCategoria.trim()) return
    try {
      await categoriasAPI.crear({ nombre: nuevaCategoria.trim() })
      setNuevaCategoria('')
      cargar()
      toast.success('Categoría agregada')
    } catch (err) { toast.error(err.message) }
  }

  const eliminar = async (cat) => {
    if (!confirm(`¿Eliminar la categoría "${cat.nombre}"?`)) return
    try {
      await categoriasAPI.eliminar(cat.id)
      cargar()
      toast.success('Categoría eliminada')
    } catch (err) { toast.error(err.message) }
  }

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Categorías</h2>
        <p className="text-xs text-slate-500 mt-1">Organizá tus productos en categorías</p>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={nuevaCategoria}
          onChange={e => setNuevaCategoria(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && agregar()}
          placeholder="Nueva categoría..."
          className="input-base flex-1"
        />
        <button onClick={agregar} className="btn-primary flex items-center gap-2">
          <Plus size={14} /> Agregar
        </button>
      </div>

      <div className="space-y-1">
        {categorias.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">No hay categorías</div>
        ) : categorias.map(c => (
          <div key={c.id} className="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-lg">
            <div className="flex items-center gap-2">
              <Tag size={14} className="text-slate-400" />
              <span className="text-sm font-medium">{c.nombre}</span>
            </div>
            <button onClick={() => eliminar(c)} className="text-red-500 hover:text-red-700 p-1">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------- MI CUENTA ----------
function SeccionCuenta() {
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [cambiando, setCambiando] = useState(false)
  const [exito, setExito] = useState(false)

  const usuario = JSON.parse(sessionStorage.getItem('pos_usuario') || '{}')

  const cambiar = async () => {
    if (!actual || !nueva) return toast.error('Completá los campos')
    if (nueva.length < 6) return toast.error('La nueva contraseña debe tener al menos 6 caracteres')
    if (nueva !== confirmar) return toast.error('Las contraseñas no coinciden')

    setCambiando(true)
    setExito(false)
    try {
      await authAPI.cambiarPassword(actual, nueva)
      setActual('')
      setNueva('')
      setConfirmar('')
      setExito(true)
      toast.success('Contraseña cambiada correctamente')
      setTimeout(() => setExito(false), 5000)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setCambiando(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="text-lg font-semibold">Mi cuenta</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-slate-500">Usuario</div>
            <div className="font-medium">{usuario.username}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Nombre</div>
            <div className="font-medium">{usuario.nombre_completo || '—'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Tipo</div>
            <div className="font-medium">{usuario.is_admin ? 'Administrador' : 'Usuario'}</div>
          </div>
        </div>
      </div>

      <div className="card space-y-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Lock size={16} className="text-brand-600" /> Cambiar contraseña
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Cambiá tu contraseña periódicamente para mantener la seguridad
          </p>
        </div>

        {exito && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800 flex items-center gap-2">
            <Check size={16} />
            Contraseña actualizada correctamente
          </div>
        )}

        <div className="space-y-3 max-w-md">
          <Field label="Contraseña actual">
            <input
              type="password"
              value={actual}
              onChange={e => setActual(e.target.value)}
              autoComplete="current-password"
              className="input-base w-full"
            />
          </Field>
          <Field label="Nueva contraseña" hint="Mínimo 6 caracteres">
            <input
              type="password"
              value={nueva}
              onChange={e => setNueva(e.target.value)}
              autoComplete="new-password"
              className="input-base w-full"
            />
          </Field>
          <Field label="Confirmar nueva contraseña">
            <input
              type="password"
              value={confirmar}
              onChange={e => setConfirmar(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && cambiar()}
              autoComplete="new-password"
              className="input-base w-full"
            />
          </Field>

          <button
            onClick={cambiar}
            disabled={cambiando}
            className="btn-primary w-full disabled:opacity-50"
          >
            {cambiando ? 'Actualizando...' : 'Cambiar contraseña'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------- SISTEMA ----------
function SeccionSistema() {
  return (
    <div className="card space-y-3">
      <h2 className="text-lg font-semibold">Información del sistema</h2>

      <div className="space-y-2 text-sm">
        <Linea label="Versión" valor="2.0.0" />
        <Linea label="Modo" valor="Local (sin internet)" />
        <Linea label="Base de datos" valor="SQLite (pos.db)" />
        <Linea label="Backend" valor="FastAPI · http://localhost:8000" />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
        <div className="font-medium mb-1">📁 Tus datos están seguros</div>
        Toda la información se guarda en el archivo <code className="bg-white px-1.5 py-0.5 rounded">pos.db</code> en la
        carpeta del backend. Hacé una copia de respaldo periódica de ese archivo.
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
        <div className="font-medium mb-1">🔄 Actualizar el sistema</div>
        Para actualizar el sistema en esta máquina, ejecutá <code className="bg-white px-1.5 py-0.5 rounded">actualizar.bat</code> en
        la carpeta del backend (asume que el proyecto está clonado de Git).
      </div>
    </div>
  )
}

function Linea({ label, valor }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-slate-100">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{valor}</span>
    </div>
  )
}

function Field({ label, children, hint }) {
  return (
    <div>
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      {children}
      {hint && <div className="text-xs text-slate-400 mt-1">{hint}</div>}
    </div>
  )
}
