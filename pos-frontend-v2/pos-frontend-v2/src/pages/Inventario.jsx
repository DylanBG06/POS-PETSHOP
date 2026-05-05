import { useEffect, useState, useCallback } from 'react'
import { Search, Plus, Edit2, Trash2, Package, AlertTriangle, Calendar, DollarSign, ArrowDownRight, Scissors } from 'lucide-react'
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
  const [modalDesglose, setModalDesglose] = useState(null)
  const [modalHijo, setModalHijo] = useState(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [prods, cats] = await Promise.all([
        productosAPI.listar({ buscar: busqueda || undefined, categoria_id: filtroCategoria || undefined }),
        categoriasAPI.listar(),
      ])
      setProductos(prods)
      setCategorias(cats)
    } catch { toast.error('Error al cargar') }
    finally { setLoading(false) }
  }, [busqueda, filtroCategoria])

  useEffect(() => {
    const t = setTimeout(cargar, 300)
    return () => clearTimeout(t)
  }, [cargar])

  const stats = {
    total: productos.length,
    bajo: productos.filter(p => p.stock <= p.stock_minimo && p.activo).length,
    valor: productos.reduce((s, p) => s + p.costo * p.stock, 0),
  }

  const eliminar = async (p) => {
    if (!confirm(`¿Eliminar "${p.nombre}"?`)) return
    try { await productosAPI.eliminar(p.id); toast.success('Eliminado'); cargar() }
    catch (err) { toast.error(err.message) }
  }

  const tieneHijos = (p) => productos.some(h => h.id_padre === p.id)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard icon={Package} label="PRODUCTOS" valor={stats.total} />
        <StatCard icon={AlertTriangle} label="STOCK BAJO" valor={stats.bajo} variante="amber" />
        <StatCard icon={DollarSign} label="VALOR INVENTARIO" valor={formatColones(stats.valor)} />
      </div>

      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar..." className="input-base w-full pl-9" />
        </div>
        <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} className="input-base">
          <option value="">Todas</option>
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
                <th className="text-left py-3 px-3 font-medium">Estado</th>
                <th className="py-3 px-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="py-12 text-center text-slate-400">Cargando...</td></tr>
              ) : productos.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-slate-400">No hay productos</td></tr>
              ) : productos.map(p => {
                const estado = estadoProducto(p)
                const esHijo = !!p.id_padre
                const esPadre = p.tipo_producto === 'COMPRABLE' && tieneHijos(p)
                return (
                  <tr key={p.id} className={`hover:bg-slate-50/80 ${esHijo ? 'bg-brand-50/30' : ''} ${p.stock <= p.stock_minimo ? 'bg-amber-50/30' : ''}`}>
                    <td className="py-2.5 px-3 font-mono text-xs text-slate-600">{p.codigo || '—'}</td>
                    <td className="py-2.5 px-3">
                      <div className={`font-medium flex items-center gap-1.5 ${esHijo ? 'pl-6' : ''}`}>
                        {esHijo && <ArrowDownRight size={12} className="text-brand-400 shrink-0" />}
                        {p.nombre}
                      </div>
                      {esHijo && (
                        <div className="text-xs text-brand-500 pl-6">
                          Derivado de {p.nombre_padre} · Factor: {p.factor_conversion}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-xs">{p.categoria?.nombre || '—'}</td>
                    <td className="py-2.5 px-3 text-right text-xs">{formatColones(p.precio_venta)}</td>
                    <td className="py-2.5 px-3 text-right text-xs">{formatColones(p.costo)}</td>
                    <td className={`py-2.5 px-3 text-right ${p.stock <= p.stock_minimo ? 'font-bold text-amber-700' : ''}`}>
                      {Math.floor(p.stock)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${estadoBadge[estado.tipo]}`}>
                        {esHijo ? 'Derivado' : esPadre ? 'Padre' : estado.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex justify-end gap-1">
                        {/* Desglosar: solo padres que tienen hijos */}
                        {esPadre && p.stock > 0 && (
                          <button onClick={() => setModalDesglose(p)} className="p-1.5 text-brand-500 hover:text-brand-700 hover:bg-brand-50 rounded" title="Desglosar">
                            <Scissors size={14} />
                          </button>
                        )}
                        {/* Crear hijo: solo COMPRABLES */}
                        {p.tipo_producto === 'COMPRABLE' && !esHijo && (
                          <button onClick={() => setModalHijo(p)} className="p-1.5 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded" title="Crear producto derivado">
                            <Plus size={14} />
                          </button>
                        )}
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

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900">
        <strong>Jerarquía de productos:</strong> Usá el botón <Plus size={10} className="inline" /> para crear un producto derivado (ej: bolsita de 1kg desde un saco de 30kg).
        Luego usá <Scissors size={10} className="inline" /> para desglosar: convertir sacos en bolsitas.
      </div>

      <ProductoModal open={modalAbierto} onClose={() => setModalAbierto(false)} producto={editando} categorias={categorias} onGuardar={() => { setModalAbierto(false); cargar() }} />
      <DesgloseModal producto={modalDesglose} onClose={() => setModalDesglose(null)} onGuardar={() => { setModalDesglose(null); cargar() }} />
      <CrearHijoModal padre={modalHijo} onClose={() => setModalHijo(null)} categorias={categorias} onGuardar={() => { setModalHijo(null); cargar() }} />
    </div>
  )
}

function StatCard({ icon: Icon, label, valor, variante = 'normal' }) {
  const v = { normal: 'bg-white border-slate-200 text-slate-800', amber: 'bg-amber-50 border-amber-200 text-amber-900' }
  const ic = { normal: 'text-slate-400', amber: 'text-amber-500' }
  return (
    <div className={`border rounded-xl p-4 ${v[variante]}`}>
      <div className="flex items-center justify-between"><div className="text-xs font-medium opacity-75">{label}</div><Icon size={16} className={ic[variante]} /></div>
      <div className="text-2xl font-bold mt-1">{valor}</div>
    </div>
  )
}

// --- Modal: Crear/editar producto ---
function ProductoModal({ open, onClose, producto, categorias, onGuardar }) {
  const [form, setForm] = useState({ codigo: '', nombre: '', precio_venta: '', costo: '', stock: 0, stock_minimo: 5, categoria_id: '', fecha_vencimiento: '' })

  useEffect(() => {
    if (producto) {
      setForm({ codigo: producto.codigo||'', nombre: producto.nombre||'', precio_venta: producto.precio_venta||'', costo: producto.costo||'', stock: producto.stock||0, stock_minimo: producto.stock_minimo||5, categoria_id: producto.categoria_id||'', fecha_vencimiento: producto.fecha_vencimiento||'' })
    } else {
      setForm({ codigo: '', nombre: '', precio_venta: '', costo: '', stock: 0, stock_minimo: 5, categoria_id: '', fecha_vencimiento: '' })
    }
  }, [producto, open])

  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const guardar = async () => {
    if (!form.nombre.trim()) return toast.error('Nombre obligatorio')
    if (!form.precio_venta || form.precio_venta <= 0) return toast.error('Precio > 0')
    const datos = {
      codigo: form.codigo.trim() || null, nombre: form.nombre.trim(), tipo_venta: 'unidad',
      precio_venta: parseFloat(form.precio_venta), costo: parseFloat(form.costo)||0,
      stock: parseInt(form.stock)||0, stock_minimo: parseInt(form.stock_minimo)||5,
      categoria_id: form.categoria_id ? parseInt(form.categoria_id) : null,
      fecha_vencimiento: form.fecha_vencimiento || null,
    }
    try {
      if (producto) { await productosAPI.actualizar(producto.id, datos); toast.success('Actualizado') }
      else { await productosAPI.crear(datos); toast.success('Creado') }
      onGuardar()
    } catch (err) { toast.error(err.message) }
  }

  return (
    <Modal open={open} onClose={onClose} title={producto ? 'Editar producto' : 'Nuevo producto'} maxWidth="max-w-2xl">
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Código"><input value={form.codigo} onChange={e => setField('codigo', e.target.value)} className="input-base w-full" placeholder="Opcional" /></Field>
          <div className="col-span-2">
            <Field label="Nombre *" hint="Incluí peso si aplica: Dog Chow 2kg"><input value={form.nombre} onChange={e => setField('nombre', e.target.value)} className="input-base w-full" autoFocus /></Field>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Precio de venta *"><input type="number" value={form.precio_venta} onChange={e => setField('precio_venta', e.target.value)} className="input-base w-full" /></Field>
          <Field label="Costo"><input type="number" value={form.costo} onChange={e => setField('costo', e.target.value)} className="input-base w-full" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Stock"><input type="number" value={form.stock} onChange={e => setField('stock', e.target.value)} className="input-base w-full" /></Field>
          <Field label="Stock mínimo"><input type="number" value={form.stock_minimo} onChange={e => setField('stock_minimo', e.target.value)} className="input-base w-full" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoría">
            <select value={form.categoria_id} onChange={e => setField('categoria_id', e.target.value)} className="input-base w-full">
              <option value="">Sin categoría</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Field>
          <Field label="Vencimiento"><input type="date" value={form.fecha_vencimiento||''} onChange={e => setField('fecha_vencimiento', e.target.value)} className="input-base w-full" /></Field>
        </div>
        {form.precio_venta && form.costo > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-800">
            Margen: {formatColones(form.precio_venta - form.costo)} ({(((form.precio_venta - form.costo) / form.precio_venta) * 100).toFixed(0)}%)
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={guardar} className="btn-primary">{producto ? 'Guardar' : 'Crear'}</button>
        </div>
      </div>
    </Modal>
  )
}

// --- Modal: Desglosar (saco → bolsitas) ---
function DesgloseModal({ producto, onClose, onGuardar }) {
  const [cantidad, setCantidad] = useState(1)
  const [hijoId, setHijoId] = useState('')
  const [hijos, setHijos] = useState([])
  const [procesando, setProcesando] = useState(false)
  const [cargandoHijos, setCargandoHijos] = useState(false)

  useEffect(() => {
    if (!producto) return
    setCantidad(1)
    setHijoId('')
    setCargandoHijos(true)
    productosAPI.hijos(producto.id)
      .then(h => {
        setHijos(h)
        if (h.length === 1) setHijoId(String(h[0].id)) // auto-seleccionar si solo hay uno
      })
      .catch(() => setHijos([]))
      .finally(() => setCargandoHijos(false))
  }, [producto])

  if (!producto) return null

  const hijoSeleccionado = hijos.find(h => String(h.id) === String(hijoId))
  const unidadesGeneradas = hijoSeleccionado ? cantidad * hijoSeleccionado.factor_conversion : 0

  const desglosar = async () => {
    if (!hijoId) return toast.error('Elegí en qué producto convertir')
    if (cantidad <= 0) return toast.error('Cantidad > 0')
    if (cantidad > producto.stock) return toast.error(`Solo hay ${Math.floor(producto.stock)} disponibles`)
    setProcesando(true)
    try {
      const res = await productosAPI.desglosar(producto.id, cantidad, parseInt(hijoId))
      toast.success(res.mensaje, { duration: 5000 })
      onGuardar()
    } catch (err) { toast.error(err.message) }
    finally { setProcesando(false) }
  }

  return (
    <Modal open={!!producto} onClose={onClose} title={`Desglosar: ${producto.nombre}`}>
      <div className="space-y-4">
        <div className="bg-brand-50 border border-brand-200 rounded-lg p-3 text-sm">
          <div className="font-medium text-brand-800">Stock disponible: {Math.floor(producto.stock)} unidades</div>
        </div>

        {cargandoHijos ? (
          <div className="text-center py-4 text-slate-400 text-sm">Cargando productos derivados...</div>
        ) : hijos.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            Este producto no tiene derivados creados. Cerrá esta ventana y usá el botón <strong>+</strong> verde primero.
          </div>
        ) : (
          <>
            <Field label="¿En qué producto querés convertirlo?">
              <div className="space-y-2">
                {hijos.map(h => (
                  <label key={h.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${String(hijoId) === String(h.id) ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <input
                      type="radio" name="hijo" value={h.id}
                      checked={String(hijoId) === String(h.id)}
                      onChange={e => setHijoId(e.target.value)}
                      className="text-brand-600"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{h.nombre}</div>
                      <div className="text-xs text-slate-500">
                        Factor: {h.factor_conversion} · Stock actual: {Math.floor(h.stock)}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </Field>

            <Field label={`¿Cuántos "${producto.nombre}" desglosar?`}>
              <input
                type="number" min="1" max={Math.floor(producto.stock)}
                value={cantidad} onChange={e => setCantidad(parseInt(e.target.value) || 0)}
                className="input-base w-full text-2xl text-center font-medium py-3"
              />
            </Field>

            {hijoSeleccionado && cantidad > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800">
                <div className="font-medium">Resultado:</div>
                <div className="text-xs mt-1">
                  · {producto.nombre}: {Math.floor(producto.stock)} → {Math.floor(producto.stock - cantidad)}
                </div>
                <div className="text-xs">
                  · {hijoSeleccionado.nombre}: {Math.floor(hijoSeleccionado.stock)} → {Math.floor(hijoSeleccionado.stock + unidadesGeneradas)} (+{Math.floor(unidadesGeneradas)})
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={desglosar} disabled={procesando || !hijoId || cantidad <= 0 || hijos.length === 0} className="btn-primary disabled:opacity-50 flex items-center gap-2">
            <Scissors size={14} /> {procesando ? 'Procesando...' : 'Desglosar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// --- Modal: Crear producto hijo ---
function CrearHijoModal({ padre, onClose, categorias, onGuardar }) {
  const [form, setForm] = useState({ codigo: '', nombre: '', precio_venta: '', factor_conversion: '' })

  useEffect(() => {
    if (padre) {
      setForm({
        codigo: padre.codigo ? padre.codigo + '-01' : '',
        nombre: '',
        precio_venta: '',
        factor_conversion: '',
      })
    }
  }, [padre])

  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  if (!padre) return null

  const costoCalculado = padre.costo && form.factor_conversion > 0
    ? Math.round(padre.costo / parseFloat(form.factor_conversion))
    : 0

  const guardar = async () => {
    if (!form.nombre.trim()) return toast.error('Nombre obligatorio')
    if (!form.precio_venta || form.precio_venta <= 0) return toast.error('Precio > 0')
    if (!form.factor_conversion || form.factor_conversion <= 0) return toast.error('Factor > 0')

    try {
      await productosAPI.crear({
        codigo: form.codigo.trim() || null,
        nombre: form.nombre.trim(),
        tipo_venta: 'unidad',
        precio_venta: parseFloat(form.precio_venta),
        costo: 0, // Se calcula automático
        stock: 0,
        stock_minimo: 5,
        categoria_id: padre.categoria_id,
        tipo_producto: 'DERIVADO',
        id_padre: padre.id,
        factor_conversion: parseFloat(form.factor_conversion),
      })
      toast.success('Producto derivado creado. Ahora podés desglosar para generar stock.')
      onGuardar()
    } catch (err) { toast.error(err.message) }
  }

  return (
    <Modal open={!!padre} onClose={onClose} title={`Crear derivado de: ${padre.nombre}`}>
      <div className="space-y-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800">
          <strong>Padre:</strong> {padre.nombre} · Costo: {formatColones(padre.costo)}
        </div>

        <Field label="Código hijo">
          <input value={form.codigo} onChange={e => setField('codigo', e.target.value)} className="input-base w-full" placeholder="Ej: 01-01" />
        </Field>

        <Field label="Nombre del producto derivado *" hint="Ej: Bolsa Magnus 1kg">
          <input value={form.nombre} onChange={e => setField('nombre', e.target.value)} className="input-base w-full" autoFocus />
        </Field>

        <Field label="Factor de conversión *" hint={`¿Cuántas unidades salen de 1 "${padre.nombre}"? Ej: 30 si el saco es de 30kg y la bolsa de 1kg`}>
          <input type="number" step="1" value={form.factor_conversion} onChange={e => setField('factor_conversion', e.target.value)} className="input-base w-full" />
        </Field>

        <Field label="Precio de venta *" hint="El precio que vos definís para ganar más vendiendo por unidad">
          <input type="number" value={form.precio_venta} onChange={e => setField('precio_venta', e.target.value)} className="input-base w-full" />
        </Field>

        {costoCalculado > 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1">
            <div className="flex justify-between"><span>Costo auto (padre ÷ factor):</span><span className="font-medium">{formatColones(costoCalculado)}</span></div>
            {form.precio_venta > 0 && (
              <div className="flex justify-between text-emerald-700"><span>Ganancia por unidad:</span><span className="font-bold">{formatColones(form.precio_venta - costoCalculado)}</span></div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={guardar} className="btn-primary">Crear derivado</button>
        </div>
      </div>
    </Modal>
  )
}
