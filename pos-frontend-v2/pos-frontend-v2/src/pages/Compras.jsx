import { useEffect, useState } from 'react'
import { Plus, Trash2, Truck, Package, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { comprasAPI, productosAPI, categoriasAPI } from '../services/api'
import { formatColones, formatFechaHora } from '../utils/format'
import Modal from '../components/Modal'

function Field({ label, children }) {
  return <div><div className="text-xs text-slate-500 mb-1">{label}</div>{children}</div>
}

export default function Compras() {
  const [compras, setCompras] = useState([])
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [detalleCompra, setDetalleCompra] = useState(null)

  const cargar = async () => {
    setLoading(true)
    try {
      const [c, p] = await Promise.all([
        comprasAPI.listar({ limit: 50 }),
        productosAPI.listar({ solo_activos: true }),
      ])
      setCompras(c)
      setProductos(p)
    } catch { toast.error('Error al cargar compras') }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const eliminarCompra = async (compra) => {
    if (!confirm(`¿Eliminar compra #${compra.id}? El stock se revertirá (se restará lo que se agregó).`)) return
    try {
      await comprasAPI.eliminar(compra.id)
      toast.success('Compra eliminada y stock revertido')
      cargar()
    } catch (err) { toast.error(err.message) }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard label="COMPRAS REGISTRADAS" valor={compras.length} icon={Truck} />
        <StatCard label="GASTO ÚLTIMO MES" valor={formatColones(compras.filter(c => new Date(c.fecha) > new Date(Date.now() - 30*24*60*60*1000)).reduce((s,c)=>s+c.total,0))} icon={Package} />
        <StatCard label="GASTO HOY" valor={formatColones(compras.filter(c => new Date(c.fecha).toDateString() === new Date().toDateString()).reduce((s,c)=>s+c.total,0))} icon={Package} resaltado />
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-slate-800">Compras a proveedores</h2>
        <button onClick={() => setModalAbierto(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Nueva compra
        </button>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="text-left py-3 px-3 font-medium">Fecha</th>
                <th className="text-left py-3 px-3 font-medium">Proveedor</th>
                <th className="text-right py-3 px-3 font-medium">Productos</th>
                <th className="text-right py-3 px-3 font-medium">Total</th>
                <th className="py-3 px-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="py-12 text-center text-slate-400">Cargando...</td></tr>
              ) : compras.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-slate-400">Sin compras registradas</td></tr>
              ) : compras.map(c => (
                <tr key={c.id} className="hover:bg-slate-50/80">
                  <td className="py-2.5 px-3 text-xs text-slate-600">{formatFechaHora(c.fecha)}</td>
                  <td className="py-2.5 px-3 font-medium">{c.proveedor || '—'}</td>
                  <td className="py-2.5 px-3 text-right text-xs">{c.detalles.length} ítem{c.detalles.length !== 1 ? 's' : ''}</td>
                  <td className="py-2.5 px-3 text-right font-medium">{formatColones(c.total)}</td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setDetalleCompra(c)} className="text-xs text-brand-600 hover:underline">Ver</button>
                      <button onClick={() => eliminarCompra(c)} className="text-xs text-red-600 hover:underline">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <CompraModal
        open={modalAbierto}
        onClose={() => setModalAbierto(false)}
        productos={productos}
        onGuardar={() => { setModalAbierto(false); cargar() }}
      />
      <DetalleModal compra={detalleCompra} onClose={() => setDetalleCompra(null)} />
    </div>
  )
}

function StatCard({ label, valor, icon: Icon, resaltado }) {
  return (
    <div className={`card ${resaltado ? 'border-brand-200 bg-brand-50/30' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-slate-500">{label}</div>
        <Icon size={14} className={resaltado ? 'text-brand-600' : 'text-slate-400'} />
      </div>
      <div className={`text-2xl font-bold mt-1 ${resaltado ? 'text-brand-700' : 'text-slate-800'}`}>{valor}</div>
    </div>
  )
}

function CompraModal({ open, onClose, productos, onGuardar }) {
  const [proveedor, setProveedor] = useState('')
  const [items, setItems] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [categorias, setCategorias] = useState([])

  // Formulario de producto nuevo
  const [creandoProducto, setCreandoProducto] = useState(false)
  const [nuevoProducto, setNuevoProducto] = useState({ nombre: '', precio_venta: '', costo: '', categoria_id: '' })

  useEffect(() => {
    if (open) {
      setProveedor(''); setItems([]); setBusqueda('')
      setCreandoProducto(false)
      categoriasAPI.listar().then(setCategorias).catch(() => {})
    }
  }, [open])

  const productosFiltrados = busqueda.trim()
    ? productos.filter(p =>
        p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.codigo?.toLowerCase().includes(busqueda.toLowerCase())
      ).slice(0, 8)
    : []

  const agregarProducto = (producto) => {
    if (items.find(i => i.producto_id === producto.id)) { toast.error('Ya está en la lista'); return }
    setItems([...items, {
      producto_id: producto.id, nombre: producto.nombre,
      cantidad: 1, costo_unit: producto.costo || 0,
    }])
    setBusqueda('')
  }

  const crearProductoNuevo = async () => {
    if (!nuevoProducto.nombre.trim()) return toast.error('El nombre es obligatorio')
    if (!nuevoProducto.precio_venta || nuevoProducto.precio_venta <= 0) return toast.error('El precio debe ser mayor a 0')

    try {
      const creado = await productosAPI.crear({
        nombre: nuevoProducto.nombre.trim(),
        tipo_venta: 'unidad',
        precio_venta: parseFloat(nuevoProducto.precio_venta),
        costo: parseFloat(nuevoProducto.costo) || 0,
        stock: 0,
        categoria_id: nuevoProducto.categoria_id ? parseInt(nuevoProducto.categoria_id) : null,
      })
      toast.success(`Producto "${creado.nombre}" creado`)
      // Agregar automáticamente a la lista de compra
      setItems([...items, {
        producto_id: creado.id, nombre: creado.nombre,
        cantidad: 1, costo_unit: parseFloat(nuevoProducto.costo) || 0,
      }])
      setCreandoProducto(false)
      setNuevoProducto({ nombre: '', precio_venta: '', costo: '', categoria_id: '' })
    } catch (err) { toast.error(err.message) }
  }

  const actualizarItem = (idx, campo, valor) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [campo]: valor } : it))
  }

  const total = items.reduce((s, it) => s + (parseInt(it.cantidad) || 0) * (parseFloat(it.costo_unit) || 0), 0)

  const guardar = async () => {
    if (items.length === 0) return toast.error('Agregá al menos un producto')
    if (items.some(it => !it.cantidad || parseInt(it.cantidad) <= 0)) return toast.error('Cantidades deben ser > 0')

    setGuardando(true)
    try {
      await comprasAPI.crear({
        proveedor: proveedor.trim() || null,
        detalles: items.map(it => ({
          producto_id: it.producto_id,
          cantidad: parseInt(it.cantidad),
          costo_unit: parseFloat(it.costo_unit),
        })),
      })
      toast.success('Compra registrada y stock actualizado')
      onGuardar()
    } catch (err) { toast.error(err.message) }
    finally { setGuardando(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Registrar compra a proveedor" maxWidth="max-w-3xl">
      <div className="space-y-4">
        <Field label="Proveedor (opcional)">
          <input value={proveedor} onChange={e => setProveedor(e.target.value)} placeholder="Ej: Distribuidora Mascotas SA" className="input-base w-full" />
        </Field>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-slate-500">Agregar productos</label>
            <button onClick={() => setCreandoProducto(!creandoProducto)} className="text-xs text-brand-600 hover:underline flex items-center gap-1">
              <Plus size={12} /> {creandoProducto ? 'Cancelar' : 'Producto nuevo'}
            </button>
          </div>

          {creandoProducto ? (
            <div className="bg-brand-50 border border-brand-200 rounded-lg p-3 space-y-2">
              <div className="text-xs font-medium text-brand-800">Crear producto nuevo (se agrega al inventario)</div>
              <div className="grid grid-cols-2 gap-2">
                <input value={nuevoProducto.nombre} onChange={e => setNuevoProducto({...nuevoProducto, nombre: e.target.value})} placeholder="Nombre del producto" className="input-base w-full text-sm" />
                <select value={nuevoProducto.categoria_id} onChange={e => setNuevoProducto({...nuevoProducto, categoria_id: e.target.value})} className="input-base w-full text-sm">
                  <option value="">Categoría</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
                <input type="number" value={nuevoProducto.precio_venta} onChange={e => setNuevoProducto({...nuevoProducto, precio_venta: e.target.value})} placeholder="Precio venta" className="input-base w-full text-sm" />
                <input type="number" value={nuevoProducto.costo} onChange={e => setNuevoProducto({...nuevoProducto, costo: e.target.value})} placeholder="Costo" className="input-base w-full text-sm" />
              </div>
              <button onClick={crearProductoNuevo} className="btn-primary text-xs py-1.5">Crear y agregar a la compra</button>
            </div>
          ) : (
            <>
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar producto existente..." className="input-base w-full" />
              {productosFiltrados.length > 0 && (
                <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  {productosFiltrados.map(p => (
                    <button key={p.id} onClick={() => agregarProducto(p)} className="w-full flex items-center justify-between p-2.5 hover:bg-slate-50 text-left text-sm border-b border-slate-100 last:border-0">
                      <div><div className="font-medium">{p.nombre}</div><div className="text-xs text-slate-500">{p.codigo || 'Sin código'} · Stock: {Math.floor(p.stock)}</div></div>
                      <Plus size={14} className="text-slate-400" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {items.length > 0 && (
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Items de la compra</div>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_100px_100px_90px_30px] gap-2 items-center bg-slate-50 p-2 rounded-lg">
                  <div className="text-sm font-medium truncate">{it.nombre}</div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-0.5">Cantidad</label>
                    <input type="number" step="1" min="1" value={it.cantidad} onChange={e => actualizarItem(idx, 'cantidad', e.target.value)} className="input-base w-full text-sm py-1.5" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-0.5">Costo unit.</label>
                    <input type="number" step="1" min="0" value={it.costo_unit} onChange={e => actualizarItem(idx, 'costo_unit', e.target.value)} className="input-base w-full text-sm py-1.5" />
                  </div>
                  <div className="text-right text-sm font-medium pt-4">{formatColones((parseInt(it.cantidad)||0) * (parseFloat(it.costo_unit)||0))}</div>
                  <button onClick={() => setItems(prev => prev.filter((_,i) => i !== idx))} className="text-red-500 hover:text-red-700 mt-4"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-slate-200 pt-3 flex justify-between items-center">
          <div className="text-xs text-slate-500">{items.length} producto{items.length !== 1 ? 's' : ''}</div>
          <div className="text-right">
            <div className="text-xs text-slate-500">TOTAL</div>
            <div className="text-2xl font-bold text-brand-700">{formatColones(total)}</div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
          Al registrar: el <strong>stock se incrementa</strong> y el <strong>costo se actualiza</strong> automáticamente.
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={guardar} disabled={guardando || items.length === 0} className="btn-primary disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Registrar compra'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function DetalleModal({ compra, onClose }) {
  if (!compra) return null
  return (
    <Modal open={!!compra} onClose={onClose} title={`Compra #${compra.id}`}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><div className="text-xs text-slate-500">Fecha</div><div>{formatFechaHora(compra.fecha)}</div></div>
          <div><div className="text-xs text-slate-500">Proveedor</div><div>{compra.proveedor || '—'}</div></div>
        </div>
        <div className="border-t border-slate-100 pt-3">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Items</div>
          {compra.detalles.map(d => (
            <div key={d.id} className="flex justify-between items-center text-sm py-2 border-b border-slate-100 last:border-0">
              <div>
                <div className="font-medium">{d.producto.nombre}</div>
                <div className="text-xs text-slate-500">{Math.floor(d.cantidad)} × {formatColones(d.costo_unit)}</div>
              </div>
              <div className="font-medium">{formatColones(d.cantidad * d.costo_unit)}</div>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-200 pt-3 flex justify-between items-baseline">
          <span className="text-sm text-slate-500">Total</span>
          <span className="text-2xl font-bold text-brand-700">{formatColones(compra.total)}</span>
        </div>
      </div>
    </Modal>
  )
}
