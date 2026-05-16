import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, Search, Calendar, Package, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { ingresosAPI, productosAPI } from '../services/api'
import { formatColones, formatFechaHora, toDateInput } from '../utils/format'
import Modal from '../components/Modal'

export default function Ingresos() {
  const [ingresos, setIngresos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (fechaInicio) params.fecha_inicio = fechaInicio
      if (fechaFin) params.fecha_fin = fechaFin
      const data = await ingresosAPI.listar(params)
      setIngresos(data)
    } catch { toast.error('Error al cargar') }
    finally { setLoading(false) }
  }, [fechaInicio, fechaFin])

  useEffect(() => { cargar() }, [cargar])

  const eliminar = async (ing) => {
    if (!confirm(`¿Eliminar este ingreso de "${ing.producto?.nombre}"? El stock se descontará.`)) return
    try {
      await ingresosAPI.eliminar(ing.id)
      toast.success('Ingreso eliminado')
      cargar()
    } catch (err) { toast.error(err.message) }
  }

  // Totales del periodo mostrado
  const totalCosto = ingresos.reduce((s, i) => s + (i.total_costo || 0), 0)
  const totalVenta = ingresos.reduce((s, i) => s + (i.total_venta || 0), 0)
  const ganancia = totalVenta - totalCosto

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="INGRESOS" valor={ingresos.length} icon={Package} />
        <StatCard label="TOTAL COSTO" valor={formatColones(totalCosto)} />
        <StatCard label="TOTAL VENTA POTENCIAL" valor={formatColones(totalVenta)} />
        <StatCard label="GANANCIA POTENCIAL" valor={formatColones(ganancia)} variante="emerald" />
      </div>

      {/* Filtros y acciones */}
      <div className="flex gap-2 items-center flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-slate-400" />
          <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="input-base text-sm" />
          <span className="text-slate-400">→</span>
          <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="input-base text-sm" />
          {(fechaInicio || fechaFin) && (
            <button onClick={() => { setFechaInicio(''); setFechaFin('') }} className="text-xs text-slate-500 hover:text-red-600">
              <X size={14} />
            </button>
          )}
        </div>
        <button onClick={() => setModalAbierto(true)} className="btn-primary flex items-center gap-2 ml-auto">
          <Plus size={16} /> Nuevo ingreso
        </button>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="text-left py-3 px-3 font-medium">Fecha</th>
                <th className="text-left py-3 px-3 font-medium">Descripción</th>
                <th className="text-right py-3 px-3 font-medium">Cant.</th>
                <th className="text-right py-3 px-3 font-medium">Costo unit.</th>
                <th className="text-right py-3 px-3 font-medium">Total costo</th>
                <th className="text-right py-3 px-3 font-medium">Venta unit.</th>
                <th className="text-right py-3 px-3 font-medium">Total venta</th>
                <th className="py-3 px-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="py-12 text-center text-slate-400">Cargando...</td></tr>
              ) : ingresos.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-slate-400">Sin ingresos registrados</td></tr>
              ) : ingresos.map(i => (
                <tr key={i.id} className="hover:bg-slate-50/80">
                  <td className="py-2.5 px-3 text-xs text-slate-600">{formatFechaHora(i.fecha)}</td>
                  <td className="py-2.5 px-3">
                    <div className="font-medium">{i.producto?.nombre || '—'}</div>
                    {i.descripcion && <div className="text-xs text-slate-500">{i.descripcion}</div>}
                  </td>
                  <td className="py-2.5 px-3 text-right">{Math.floor(i.cantidad)}</td>
                  <td className="py-2.5 px-3 text-right text-xs">{formatColones(i.costo_unit)}</td>
                  <td className="py-2.5 px-3 text-right font-medium">{formatColones(i.total_costo)}</td>
                  <td className="py-2.5 px-3 text-right text-xs">{formatColones(i.venta_unit)}</td>
                  <td className="py-2.5 px-3 text-right font-medium text-emerald-700">{formatColones(i.total_venta)}</td>
                  <td className="py-2.5 px-3 text-right">
                    <button onClick={() => eliminar(i)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {ingresos.length > 0 && (
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr className="font-semibold">
                  <td colSpan={4} className="py-3 px-3 text-right text-sm">TOTALES:</td>
                  <td className="py-3 px-3 text-right">{formatColones(totalCosto)}</td>
                  <td></td>
                  <td className="py-3 px-3 text-right text-emerald-700">{formatColones(totalVenta)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <IngresoModal open={modalAbierto} onClose={() => setModalAbierto(false)} onGuardar={() => { setModalAbierto(false); cargar() }} />
    </div>
  )
}

function StatCard({ label, valor, icon: Icon, variante = 'normal' }) {
  const v = { normal: 'bg-white border-slate-200', emerald: 'bg-emerald-50 border-emerald-200' }
  return (
    <div className={`border rounded-xl p-4 ${v[variante]}`}>
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-slate-500">{label}</div>
        {Icon && <Icon size={16} className="text-slate-400" />}
      </div>
      <div className={`text-xl font-bold mt-1 ${variante === 'emerald' ? 'text-emerald-700' : 'text-slate-800'}`}>{valor}</div>
    </div>
  )
}

function IngresoModal({ open, onClose, onGuardar }) {
  const [productos, setProductos] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [productoSel, setProductoSel] = useState(null)
  const [descripcion, setDescripcion] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [costoUnit, setCostoUnit] = useState('')
  const [ventaUnit, setVentaUnit] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [creandoProducto, setCreandoProducto] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')

  useEffect(() => {
    if (open) {
      setBusqueda(''); setProductoSel(null); setDescripcion('')
      setCantidad(''); setCostoUnit(''); setVentaUnit('')
      setCreandoProducto(false); setNuevoNombre('')
    }
  }, [open])

  // Buscar productos al escribir
  useEffect(() => {
    if (!busqueda || busqueda.length < 2 || productoSel) { setProductos([]); return }
    const t = setTimeout(async () => {
      try {
        const res = await productosAPI.buscarRapido(busqueda)
        setProductos(res.slice(0, 8))
      } catch { setProductos([]) }
    }, 200)
    return () => clearTimeout(t)
  }, [busqueda, productoSel])

  const seleccionarProducto = (p) => {
    setProductoSel(p)
    setBusqueda(p.nombre)
    setProductos([])
    // Sugerir valores actuales del producto
    if (p.costo) setCostoUnit(p.costo)
    if (p.precio_venta) setVentaUnit(p.precio_venta)
  }

  const crearProductoRapido = async () => {
    if (!nuevoNombre.trim()) return toast.error('Ingresá un nombre')
    if (!costoUnit || costoUnit <= 0) return toast.error('Costo > 0')
    if (!ventaUnit || ventaUnit <= 0) return toast.error('Venta > 0')
    try {
      const creado = await productosAPI.crear({
        nombre: nuevoNombre.trim(),
        tipo_venta: 'unidad',
        precio_venta: parseFloat(ventaUnit),
        costo: parseFloat(costoUnit),
        stock: 0,
        stock_minimo: 5,
      })
      setProductoSel(creado)
      setBusqueda(creado.nombre)
      setCreandoProducto(false)
      toast.success('Producto creado')
    } catch (err) { toast.error(err.message) }
  }

  const cant = parseFloat(cantidad) || 0
  const costo = parseFloat(costoUnit) || 0
  const venta = parseFloat(ventaUnit) || 0
  const totalCosto = cant * costo
  const totalVenta = cant * venta

  const guardar = async () => {
    if (!productoSel) return toast.error('Seleccioná un producto')
    if (cant <= 0) return toast.error('Cantidad > 0')
    if (costo < 0) return toast.error('Costo no puede ser negativo')
    if (venta < 0) return toast.error('Venta no puede ser negativa')

    setGuardando(true)
    try {
      await ingresosAPI.crear({
        producto_id: productoSel.id,
        descripcion: descripcion.trim() || null,
        cantidad: cant,
        costo_unit: costo,
        venta_unit: venta,
      })
      toast.success('Ingreso registrado')
      onGuardar()
    } catch (err) { toast.error(err.message) }
    finally { setGuardando(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Registrar ingreso de inventario" maxWidth="max-w-2xl">
      <div className="space-y-4">
        {/* Buscador o creador de producto */}
        {!creandoProducto ? (
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Producto</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text" value={busqueda}
                onChange={e => { setBusqueda(e.target.value); setProductoSel(null) }}
                placeholder="Buscar producto..."
                className="input-base w-full pl-9"
                autoFocus
              />
              {productos.length > 0 && !productoSel && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {productos.map(p => (
                    <button key={p.id} type="button" onClick={() => seleccionarProducto(p)}
                      className="w-full text-left px-3 py-2 hover:bg-brand-50 text-sm border-b border-slate-100 last:border-0">
                      <div className="font-medium">{p.nombre}</div>
                      <div className="text-xs text-slate-500">Stock: {Math.floor(p.stock)} · Costo: {formatColones(p.costo)} · Venta: {formatColones(p.precio_venta)}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {productoSel && (
              <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded p-2 text-xs text-emerald-800 flex justify-between items-center">
                <span>✓ <strong>{productoSel.nombre}</strong> · Stock actual: {Math.floor(productoSel.stock)}</span>
                <button onClick={() => { setProductoSel(null); setBusqueda('') }} className="text-emerald-700 hover:underline">cambiar</button>
              </div>
            )}
            <button onClick={() => setCreandoProducto(true)} className="text-xs text-brand-600 hover:underline mt-2">
              + ¿No existe? Crear producto rápido
            </button>
          </div>
        ) : (
          <div className="bg-slate-50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between items-center">
              <div className="text-xs font-medium text-slate-600">Crear producto nuevo</div>
              <button onClick={() => setCreandoProducto(false)} className="text-xs text-slate-500 hover:text-red-600">cancelar</button>
            </div>
            <input type="text" value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} placeholder="Nombre del producto" className="input-base w-full" autoFocus />
            <div className="text-xs text-slate-500">Completá costo y venta abajo, luego presioná "Crear"</div>
            <button onClick={crearProductoRapido} className="btn-primary text-sm w-full">Crear producto</button>
          </div>
        )}

        {/* Descripción opcional */}
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">Descripción (opcional)</label>
          <input type="text" value={descripcion} onChange={e => setDescripcion(e.target.value)}
            placeholder="Ej: lote del 15/05, proveedor X, etc." className="input-base w-full" />
        </div>

        {/* Cantidad, costo y venta */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Cantidad</label>
            <input type="number" min="0" step="1" value={cantidad} onChange={e => setCantidad(e.target.value)}
              placeholder="0" className="input-base w-full text-right" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Costo unit. (₡)</label>
            <input type="number" min="0" value={costoUnit} onChange={e => setCostoUnit(e.target.value)}
              placeholder="0" className="input-base w-full text-right" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Venta unit. (₡)</label>
            <input type="number" min="0" value={ventaUnit} onChange={e => setVentaUnit(e.target.value)}
              placeholder="0" className="input-base w-full text-right" />
          </div>
        </div>

        {/* Totales calculados */}
        {(totalCosto > 0 || totalVenta > 0) && (
          <div className="bg-slate-50 rounded-lg p-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-slate-500">Total costo</div>
              <div className="text-lg font-bold text-slate-800">{formatColones(totalCosto)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Total venta potencial</div>
              <div className="text-lg font-bold text-emerald-700">{formatColones(totalVenta)}</div>
            </div>
            {totalVenta > totalCosto && (
              <div className="col-span-2 text-xs text-emerald-700 border-t border-slate-200 pt-2">
                Ganancia potencial: <strong>{formatColones(totalVenta - totalCosto)}</strong>
              </div>
            )}
          </div>
        )}

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
          Al guardar: el <strong>stock se incrementa</strong> en {cant || 0} unidades.
          Los precios del producto se actualizan a costo {formatColones(costo)} y venta {formatColones(venta)}.
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={guardar} disabled={guardando || !productoSel || cant <= 0} className="btn-primary disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Registrar ingreso'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
