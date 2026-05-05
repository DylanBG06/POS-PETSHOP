import { useEffect, useState, useCallback } from 'react'
import { Search, Plus, Edit2, Trash2, Package, AlertTriangle, Calendar, DollarSign } from 'lucide-react'
import toast from 'react-hot-toast'
import { productosAPI, categoriasAPI } from '../services/api'
import { formatColones, formatFecha, estadoProducto } from '../utils/format'
import Modal from '../components/Modal'

const estadoBadge = {
  ok: 'bg-emerald-50 text-emerald-700',
  bajo: 'bg-amber-100 text-amber-800',
  vence: 'bg-red-100 text-red-800',
  inactivo: 'bg-slate-100 text-slate-600',
}
const filaResaltado = {
  bajo: 'bg-amber-50/50', vence: 'bg-red-50/50', ok: '', inactivo: 'opacity-50',
}

// Field FUERA del modal para evitar que se recree en cada render (fix foco)
function Field({ label, children, hint }) {
  return (
    <div>
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      {children}
      {hint && <div className="text-xs text-slate-400 mt-1">{hint}</div>}
    </div>
  )
}

export default function Inventario() {
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando] = useState(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [prods, cats] = await Promise.all([
        productosAPI.listar({
          buscar: busqueda || undefined,
          categoria_id: filtroCategoria || undefined,
        }),
        categoriasAPI.listar(),
      ])
      setProductos(prods)
      setCategorias(cats)
    } catch {
      toast.error('Error al cargar productos')
    } finally {
      setLoading(false)
    }
  }, [busqueda, filtroCategoria])

  useEffect(() => {
    const t = setTimeout(cargar, 300)
    return () => clearTimeout(t)
  }, [cargar])

  const stats = {
    total: productos.length,
    bajo: productos.filter(p => p.stock <= p.stock_minimo && p.activo).length,
    vence: productos.filter(p => {
      if (!p.fecha_vencimiento) return false
      const dias = Math.ceil((new Date(p.fecha_vencimiento) - new Date()) / (1000*60*60*24))
      return dias >= 0 && dias <= 30
    }).length,
    valor: productos.reduce((s, p) => s + p.costo * p.stock, 0),
  }

  const eliminar = async (p) => {
    if (!confirm(`¿Eliminar "${p.nombre}"?`)) return
    try {
      await productosAPI.eliminar(p.id)
      toast.success('Producto eliminado')
      cargar()
    } catch (err) { toast.error(err.message) }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Package} label="PRODUCTOS" valor={stats.total} />
        <StatCard icon={AlertTriangle} label="STOCK BAJO" valor={stats.bajo} variante="amber" />
        <StatCard icon={Calendar} label="POR VENCER" valor={stats.vence} variante="red" />
        <StatCard icon={DollarSign} label="VALOR INVENTARIO" valor={formatColones(stats.valor)} />
      </div>

      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar producto..."
            className="input-base w-full pl-9"
          />
        </div>
        <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} className="input-base">
          <option value="">Todas las categorías</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <button onClick={() => { setEditando(null); setModalAbierto(true) }} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Nuevo producto
        </button>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="text-left py-3 px-3 font-medium">Código</th>
                <th className="text-left py-3 px-3 font-medium">Producto</th>
                <th className="text-left py-3 px-3 font-medium">Categoría</th>
                <th className="text-right py-3 px-3 font-medium">Precio</th>
                <th className="text-right py-3 px-3 font-medium">Costo</th>
                <th className="text-right py-3 px-3 font-medium">Stock</th>
                <th className="text-left py-3 px-3 font-medium">Vence</th>
                <th className="text-left py-3 px-3 font-medium">Estado</th>
                <th className="py-3 px-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={9} className="py-12 text-center text-slate-400">Cargando...</td></tr>
              ) : productos.length === 0 ? (
                <tr><td colSpan={9} className="py-12 text-center text-slate-400">No hay productos</td></tr>
              ) : productos.map(p => {
                const estado = estadoProducto(p)
                return (
                  <tr key={p.id} className={`${filaResaltado[estado.tipo] || ''} hover:bg-slate-50/80`}>
                    <td className="py-2.5 px-3 font-mono text-xs text-slate-600">{p.codigo || '—'}</td>
                    <td className="py-2.5 px-3 font-medium">{p.nombre}</td>
                    <td className="py-2.5 px-3 text-slate-500 text-xs">{p.categoria?.nombre || '—'}</td>
                    <td className="py-2.5 px-3 text-right text-xs">{formatColones(p.precio_venta)}</td>
                    <td className="py-2.5 px-3 text-right text-xs">{formatColones(p.costo)}</td>
                    <td className={`py-2.5 px-3 text-right ${p.stock <= p.stock_minimo ? 'font-bold text-amber-700' : ''}`}>
                      {Math.floor(p.stock)}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-slate-500">{p.fecha_vencimiento ? formatFecha(p.fecha_vencimiento) : '—'}</td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${estadoBadge[estado.tipo]}`}>
                        {estado.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => { setEditando(p); setModalAbierto(true) }} className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => eliminar(p)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ProductoModal
        open={modalAbierto}
        onClose={() => setModalAbierto(false)}
        producto={editando}
        categorias={categorias}
        onGuardar={() => { setModalAbierto(false); cargar() }}
      />
    </div>
  )
}

function StatCard({ icon: Icon, label, valor, variante = 'normal' }) {
  const variantes = {
    normal: 'bg-white border-slate-200 text-slate-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    red: 'bg-red-50 border-red-200 text-red-900',
  }
  const iconColor = { normal: 'text-slate-400', amber: 'text-amber-500', red: 'text-red-500' }
  return (
    <div className={`border rounded-xl p-4 ${variantes[variante]}`}>
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium opacity-75">{label}</div>
        <Icon size={16} className={iconColor[variante]} />
      </div>
      <div className="text-2xl font-bold mt-1">{valor}</div>
    </div>
  )
}

function ProductoModal({ open, onClose, producto, categorias, onGuardar }) {
  const [form, setForm] = useState({
    codigo: '', nombre: '', precio_venta: '', costo: '',
    stock: 0, stock_minimo: 5, categoria_id: '', fecha_vencimiento: '',
  })

  useEffect(() => {
    if (producto) {
      setForm({
        codigo: producto.codigo || '',
        nombre: producto.nombre || '',
        precio_venta: producto.precio_venta || '',
        costo: producto.costo || '',
        stock: producto.stock || 0,
        stock_minimo: producto.stock_minimo || 5,
        categoria_id: producto.categoria_id || '',
        fecha_vencimiento: producto.fecha_vencimiento || '',
      })
    } else {
      setForm({ codigo: '', nombre: '', precio_venta: '', costo: '', stock: 0, stock_minimo: 5, categoria_id: '', fecha_vencimiento: '' })
    }
  }, [producto, open])

  // Actualizar un campo sin recrear todo el componente
  const setField = (campo, valor) => {
    setForm(prev => ({ ...prev, [campo]: valor }))
  }

  const guardar = async () => {
    if (!form.nombre.trim()) return toast.error('El nombre es obligatorio')
    if (!form.precio_venta || form.precio_venta <= 0) return toast.error('El precio debe ser mayor a 0')

    const datos = {
      codigo: form.codigo.trim() || null,
      nombre: form.nombre.trim(),
      tipo_venta: 'unidad',
      precio_venta: parseFloat(form.precio_venta),
      costo: parseFloat(form.costo) || 0,
      stock: parseInt(form.stock) || 0,
      stock_minimo: parseInt(form.stock_minimo) || 5,
      categoria_id: form.categoria_id ? parseInt(form.categoria_id) : null,
      fecha_vencimiento: form.fecha_vencimiento || null,
    }

    try {
      if (producto) {
        await productosAPI.actualizar(producto.id, datos)
        toast.success('Producto actualizado')
      } else {
        await productosAPI.crear(datos)
        toast.success('Producto creado')
      }
      onGuardar()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={producto ? 'Editar producto' : 'Nuevo producto'} maxWidth="max-w-2xl">
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Código">
            <input value={form.codigo} onChange={e => setField('codigo', e.target.value)} className="input-base w-full" placeholder="Opcional" />
          </Field>
          <div className="col-span-2">
            <Field label="Nombre *" hint="Incluí peso/tamaño si aplica. Ej: Dog Chow 2kg">
              <input value={form.nombre} onChange={e => setField('nombre', e.target.value)} className="input-base w-full" autoFocus />
            </Field>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Precio de venta *">
            <input type="number" step="1" value={form.precio_venta} onChange={e => setField('precio_venta', e.target.value)} className="input-base w-full" />
          </Field>
          <Field label="Costo">
            <input type="number" step="1" value={form.costo} onChange={e => setField('costo', e.target.value)} className="input-base w-full" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Stock actual (unidades/bolsas)">
            <input type="number" step="1" value={form.stock} onChange={e => setField('stock', e.target.value)} className="input-base w-full" />
          </Field>
          <Field label="Stock mínimo (alerta)">
            <input type="number" step="1" value={form.stock_minimo} onChange={e => setField('stock_minimo', e.target.value)} className="input-base w-full" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoría">
            <select value={form.categoria_id} onChange={e => setField('categoria_id', e.target.value)} className="input-base w-full">
              <option value="">Sin categoría</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Field>
          <Field label="Fecha de vencimiento">
            <input type="date" value={form.fecha_vencimiento || ''} onChange={e => setField('fecha_vencimiento', e.target.value)} className="input-base w-full" />
          </Field>
        </div>

        {form.precio_venta && form.costo > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-800">
            Margen: {formatColones(form.precio_venta - form.costo)} ({(((form.precio_venta - form.costo) / form.precio_venta) * 100).toFixed(0)}%) por unidad
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={guardar} className="btn-primary">{producto ? 'Guardar cambios' : 'Crear producto'}</button>
        </div>
      </div>
    </Modal>
  )
}
