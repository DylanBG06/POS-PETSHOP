import { useEffect, useState, useCallback } from 'react'
import { Search, Plus, Edit2, Trash2, Package, AlertTriangle, DollarSign, ArrowDownRight, Scissors, Link2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { productosAPI, categoriasAPI } from '../services/api'
import { formatColones, estadoProducto } from '../utils/format'
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
  const [modalVincular, setModalVincular] = useState(null)

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

      <div className="flex gap-2 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar..." className="input-base w-full pl-9" />
        </div>
        <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} className="input-base">
          <option value="">Todas</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <button onClick={() => setModalVincular({})} className="btn-secondary flex items-center gap-1.5 text-sm">
          <Link2 size={14} /> Vincular huérfano
        </button>
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
                        {esPadre && p.stock > 0 && (
                          <button onClick={() => setModalDesglose(p)} className="p-1.5 text-brand-500 hover:text-brand-700 hover:bg-brand-50 rounded" title="Desglosar">
                            <Scissors size={14} />
                          </button>
                        )}
                        {p.tipo_producto === 'COMPRABLE' && !esHijo && (
                          <button onClick={() => setModalHijo(p)} className="p-1.5 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded" title="Crear derivado">
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

      <ProductoModal open={modalAbierto} onClose={() => setModalAbierto(false)} producto={editando} categorias={categorias} onGuardar={() => { setModalAbierto(false); cargar() }} />
      <DesgloseModal producto={modalDesglose} onClose={() => setModalDesglose(null)} onGuardar={() => { setModalDesglose(null); cargar() }} />
      <CrearHijoModal padre={modalHijo} onClose={() => setModalHijo(null)} categorias={categorias} onGuardar={() => { setModalHijo(null); cargar() }} />
      <VincularPadreModal abierto={!!modalVincular} onClose={() => setModalVincular(null)} onGuardar={() => { setModalVincular(null); cargar() }} />
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

// ─── Crear/editar producto ───
function ProductoModal({ open, onClose, producto, categorias, onGuardar }) {
  const [form, setForm] = useState({ codigo: '', nombre: '', precio_venta: '', costo: '', stock: 0, stock_minimo: 5, categoria_id: '', fecha_vencimiento: '' })

  useEffect(() => {
    if (producto) {
      setForm({ codigo: producto.codigo || '', nombre: producto.nombre || '', precio_venta: producto.precio_venta || '', costo: producto.costo || '', stock: producto.stock || 0, stock_minimo: producto.stock_minimo || 5, categoria_id: producto.categoria_id || '', fecha_vencimiento: producto.fecha_vencimiento || '' })
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
      precio_venta: parseFloat(form.precio_venta), costo: parseFloat(form.costo) || 0,
      stock: parseInt(form.stock) || 0, stock_minimo: parseInt(form.stock_minimo) || 5,
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
            <Field label="Nombre *" hint="Incluí peso si aplica: Dog Chow 2kg">
              <input value={form.nombre} onChange={e => setField('nombre', e.target.value)} className="input-base w-full" autoFocus />
            </Field>
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
          <Field label="Vencimiento">
            <input type="date" value={form.fecha_vencimiento || ''} onChange={e => setField('fecha_vencimiento', e.target.value)} className="input-base w-full" />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={guardar} className="btn-primary">{producto ? 'Guardar' : 'Crear'}</button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Desglose multi-formato ───
function DesgloseModal({ producto, onClose, onGuardar }) {
  const [hijos, setHijos] = useState([])
  const [items, setItems] = useState({})  // {hijoId: cantidadHijos}
  const [procesando, setProcesando] = useState(false)
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    if (!producto) return
    setItems({})
    setCargando(true)
    productosAPI.hijos(producto.id)
      .then(setHijos)
      .catch(() => setHijos([]))
      .finally(() => setCargando(false))
  }, [producto])

  if (!producto) return null

  // Calcular total de "padres equivalentes" consumidos
  const totalPadresConsumidos = hijos.reduce((sum, h) => {
    const cantidadHijo = parseFloat(items[h.id] || 0)
    if (!cantidadHijo || cantidadHijo <= 0 || !h.factor_conversion) return sum
    return sum + (cantidadHijo / h.factor_conversion)
  }, 0)

  // Tolerancia de 1% para evitar problemas de decimales periódicos (ej: 46/6=7.666...)
  const stockSuficiente = totalPadresConsumidos <= producto.stock + 0.01
  const tieneAlgo = totalPadresConsumidos > 0.0001
  const stockRestante = Math.max(0, producto.stock - totalPadresConsumidos)
  const porcentajeUsado = producto.stock > 0 ? (totalPadresConsumidos / producto.stock) * 100 : 0

  const cambiarCantidad = (hijoId, valor) => {
    // Validar que sea un número positivo o vacío
    if (valor === '' || /^\d*\.?\d*$/.test(valor)) {
      setItems(prev => ({ ...prev, [hijoId]: valor }))
    }
  }

  const desglosar = async () => {
    if (!tieneAlgo) return toast.error('Ingresá al menos una cantidad')
    if (!stockSuficiente) return toast.error(`Necesitás ${totalPadresConsumidos.toFixed(3)} unidades, hay ${producto.stock}`)

    // Construir items para el backend (solo los con cantidad > 0 y factor válido)
    const itemsBody = hijos
      .filter(h => parseFloat(items[h.id] || 0) > 0 && h.factor_conversion > 0)
      .map(h => ({
        hijo_id: h.id,
        cantidad_padres: parseFloat(items[h.id]) / h.factor_conversion,
      }))

    if (itemsBody.length === 0) return toast.error('Ningún formato válido seleccionado')

    setProcesando(true)
    try {
      const res = await productosAPI.desglosar(producto.id, { items: itemsBody })
      toast.success(res.mensaje, { duration: 5000 })
      onGuardar()
    } catch (err) {
      toast.error(err.message || 'Error al desglosar')
    }
    finally { setProcesando(false) }
  }

  return (
    <Modal open={!!producto} onClose={onClose} title={`Desglosar: ${producto.nombre}`} maxWidth="max-w-2xl">
      <div className="space-y-4">
        <div className="bg-brand-50 border border-brand-200 rounded-lg p-3 text-sm">
          <div className="font-medium text-brand-800">Stock disponible: {producto.stock} unidades</div>
          <div className="text-xs text-brand-700 mt-1">
            Ingresá cuántas unidades de cada formato querés generar. Podés combinar varios formatos a la vez.
          </div>
        </div>

        {cargando ? (
          <div className="text-center py-4 text-slate-400">Cargando productos derivados...</div>
        ) : hijos.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            No hay productos derivados. Cerrá esta ventana y usá el botón <strong>+</strong> verde primero.
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Cantidades a generar</div>
            {hijos.map(h => {
              const cantidadHijo = parseFloat(items[h.id] || 0)
              const padresConsumidos = cantidadHijo / h.factor_conversion
              return (
                <div key={h.id} className="bg-slate-50 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{h.nombre}</div>
                      <div className="text-xs text-slate-500">
                        Stock actual: {Math.floor(h.stock)} · 1 padre = {h.factor_conversion} unidades
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="text" inputMode="decimal"
                        value={items[h.id] || ''}
                        onChange={e => cambiarCantidad(h.id, e.target.value)}
                        placeholder="0"
                        className="input-base w-24 text-right"
                      />
                      <span className="text-xs text-slate-500">unidades</span>
                    </div>
                  </div>
                  {cantidadHijo > 0 && (
                    <div className="mt-2 text-xs text-brand-700 bg-brand-50 rounded px-2 py-1">
                      Consume {padresConsumidos.toFixed(4)} unidades del padre
                    </div>
                  )}
                </div>
              )
            })}

            {/* Resumen visual del consumo */}
            <div className={`rounded-lg p-3 mt-3 border ${stockSuficiente ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Total consumido:</span>
                <span className={`text-lg font-bold ${stockSuficiente ? 'text-emerald-700' : 'text-red-700'}`}>
                  {totalPadresConsumidos.toFixed(4)} / {producto.stock}
                </span>
              </div>
              {tieneAlgo && stockSuficiente && (
                <>
                  <div className="text-xs text-slate-600 mb-1">
                    Uso: <strong>{porcentajeUsado.toFixed(1)}%</strong> del stock
                  </div>
                  <div className="text-xs text-slate-600">
                    Restante después del desglose: <strong>{stockRestante.toFixed(4)} unidades</strong>
                    {stockRestante < 0.01 && stockRestante > 0 && (
                      <span className="text-emerald-700 ml-1">(se limpia a 0 automáticamente)</span>
                    )}
                  </div>
                </>
              )}
              {!stockSuficiente && tieneAlgo && (
                <div className="text-xs text-red-700 mt-1">
                  ⚠️ Excede el stock disponible. Reducí las cantidades.
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={desglosar} disabled={procesando || !tieneAlgo || !stockSuficiente || hijos.length === 0} className="btn-primary disabled:opacity-50 flex items-center gap-2">
            <Scissors size={14} /> {procesando ? 'Procesando...' : 'Desglosar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Crear hijo ───
function CrearHijoModal({ padre, onClose, categorias, onGuardar }) {
  const [form, setForm] = useState({ codigo: '', nombre: '', precio_venta: '', factor_conversion: '' })

  useEffect(() => {
    if (padre) setForm({ codigo: padre.codigo ? padre.codigo + '-01' : '', nombre: '', precio_venta: '', factor_conversion: '' })
  }, [padre])

  if (!padre) return null

  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }))
  const costoCalc = padre.costo && form.factor_conversion > 0
    ? Math.round(padre.costo / parseFloat(form.factor_conversion)) : 0

  const guardar = async () => {
    if (!form.nombre.trim()) return toast.error('Nombre obligatorio')
    if (!form.precio_venta || form.precio_venta <= 0) return toast.error('Precio > 0')
    if (!form.factor_conversion || form.factor_conversion <= 0) return toast.error('Factor > 0')
    try {
      await productosAPI.crear({
        codigo: form.codigo.trim() || null, nombre: form.nombre.trim(),
        tipo_venta: 'unidad', precio_venta: parseFloat(form.precio_venta),
        costo: 0, stock: 0, stock_minimo: 5,
        categoria_id: padre.categoria_id, tipo_producto: 'DERIVADO',
        id_padre: padre.id, factor_conversion: parseFloat(form.factor_conversion),
      })
      toast.success('Producto derivado creado')
      onGuardar()
    } catch (err) { toast.error(err.message) }
  }

  return (
    <Modal open={!!padre} onClose={onClose} title={`Crear derivado de: ${padre.nombre}`}>
      <div className="space-y-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800">
          <strong>Padre:</strong> {padre.nombre} · Costo: {formatColones(padre.costo)}
        </div>
        <Field label="Código"><input value={form.codigo} onChange={e => setField('codigo', e.target.value)} className="input-base w-full" /></Field>
        <Field label="Nombre del derivado *" hint="Ej: Bolsa 1kg"><input value={form.nombre} onChange={e => setField('nombre', e.target.value)} className="input-base w-full" autoFocus /></Field>
        <Field label="Factor de conversión *" hint={`¿Cuántas unidades salen de 1 "${padre.nombre}"?`}>
          <input type="number" value={form.factor_conversion} onChange={e => setField('factor_conversion', e.target.value)} className="input-base w-full" />
        </Field>
        <Field label="Precio de venta *">
          <input type="number" value={form.precio_venta} onChange={e => setField('precio_venta', e.target.value)} className="input-base w-full" />
        </Field>
        {costoCalc > 0 && (
          <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1">
            <div className="flex justify-between"><span>Costo auto:</span><span className="font-medium">{formatColones(costoCalc)}</span></div>
            {form.precio_venta > 0 && (
              <div className="flex justify-between text-emerald-700"><span>Ganancia:</span><span className="font-bold">{formatColones(form.precio_venta - costoCalc)}</span></div>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2"><button onClick={onClose} className="btn-secondary">Cancelar</button><button onClick={guardar} className="btn-primary">Crear</button></div>
      </div>
    </Modal>
  )
}

// ─── Vincular huérfano a un padre ───
function VincularPadreModal({ abierto, onClose, onGuardar }) {
  const [huerfanos, setHuerfanos] = useState([])
  const [padresDisponibles, setPadresDisponibles] = useState([])
  const [productoId, setProductoId] = useState('')
  const [padreId, setPadreId] = useState('')
  const [factor, setFactor] = useState('')
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setProductoId(''); setPadreId(''); setFactor('')
    setCargando(true)
    Promise.all([
      productosAPI.huerfanos(),
      productosAPI.listar({ solo_comprables: true }),
    ]).then(([h, todos]) => {
      setHuerfanos(h)
      // Padres disponibles: COMPRABLES sin padre
      setPadresDisponibles(todos.filter(p => p.tipo_producto === 'COMPRABLE' && !p.id_padre))
    }).finally(() => setCargando(false))
  }, [abierto])

  if (!abierto) return null

  const productoSel = huerfanos.find(p => String(p.id) === String(productoId))
  const padreSel = padresDisponibles.find(p => String(p.id) === String(padreId))
  const costoCalc = padreSel?.costo && factor > 0 ? Math.round(padreSel.costo / parseFloat(factor)) : 0

  const guardar = async () => {
    if (!productoId) return toast.error('Elegí el producto a vincular')
    if (!padreId) return toast.error('Elegí el producto padre')
    if (productoId === padreId) return toast.error('No puede ser padre de sí mismo')
    if (!factor || factor <= 0) return toast.error('Factor > 0')

    setGuardando(true)
    try {
      await productosAPI.vincularPadre(parseInt(productoId), parseInt(padreId), parseFloat(factor))
      toast.success(`"${productoSel.nombre}" vinculado como hijo de "${padreSel.nombre}"`)
      onGuardar()
    } catch (err) { toast.error(err.message) }
    finally { setGuardando(false) }
  }

  return (
    <Modal open={abierto} onClose={onClose} title="Vincular producto huérfano a un padre" maxWidth="max-w-2xl">
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          Esta opción permite tomar un producto que ya existe en el inventario (con stock e historial)
          y convertirlo en hijo de otro. Útil cuando ya tenías bolsas pequeñas en stock antes de empezar a comprar sacos.
        </div>

        {cargando ? (
          <div className="text-center py-6 text-slate-400">Cargando productos...</div>
        ) : huerfanos.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            No hay productos sin padre disponibles. Todos tus productos ya están vinculados o son padres.
          </div>
        ) : (
          <>
            <Field label="Producto a vincular (será el hijo)">
              <select value={productoId} onChange={e => setProductoId(e.target.value)} className="input-base w-full">
                <option value="">— Elegí un producto —</option>
                {huerfanos.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} (stock: {Math.floor(p.stock)}, costo: {formatColones(p.costo)})
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Producto padre (saco/contenedor)">
              <select value={padreId} onChange={e => setPadreId(e.target.value)} className="input-base w-full">
                <option value="">— Elegí el padre —</option>
                {padresDisponibles.filter(p => String(p.id) !== productoId).map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} (costo: {formatColones(p.costo)})
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Factor de conversión"
              hint={padreSel && productoSel ? `¿Cuántas "${productoSel.nombre}" salen de 1 "${padreSel.nombre}"?` : '¿Cuántas unidades hijo salen de 1 padre?'}
            >
              <input type="number" min="0.01" step="0.01" value={factor} onChange={e => setFactor(e.target.value)} className="input-base w-full" placeholder="Ej: 30" />
            </Field>

            {costoCalc > 0 && productoSel && (
              <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span>Costo recalculado del hijo:</span>
                  <span className="font-medium">{formatColones(costoCalc)}</span>
                </div>
                <div className="text-slate-500">El stock actual ({Math.floor(productoSel.stock)}) se mantiene</div>
              </div>
            )}
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button
            onClick={guardar}
            disabled={guardando || !productoId || !padreId || !factor || huerfanos.length === 0}
            className="btn-primary disabled:opacity-50 flex items-center gap-2"
          >
            <Link2 size={14} /> {guardando ? 'Vinculando...' : 'Vincular'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
