import { useEffect, useRef, useState } from 'react'
import { Search, Plus, Minus, X, AlertCircle, Scale } from 'lucide-react'
import toast from 'react-hot-toast'
import { productosAPI, ventasAPI } from '../services/api'
import { formatColones, labelPrecio, formatStock } from '../utils/format'

export default function Ventas() {
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState([])
  const [carrito, setCarrito] = useState([])
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [montoRecibido, setMontoRecibido] = useState('')
  const [cobrando, setCobrando] = useState(false)

  // Modal para producto por peso
  const [modalPeso, setModalPeso] = useState(null) // {producto, cantidad}

  const inputRef = useRef(null)
  const inputPesoRef = useRef(null)

  useEffect(() => {
    if (!busqueda.trim()) { setResultados([]); return }
    const timer = setTimeout(() => {
      productosAPI.buscarRapido(busqueda).then(setResultados).catch(() => setResultados([]))
    }, 200)
    return () => clearTimeout(timer)
  }, [busqueda])

  useEffect(() => {
    const handler = (e) => {
      if (modalPeso) return // No interceptar atajos cuando hay modal
      if (e.key === 'F2') { e.preventDefault(); inputRef.current?.focus() }
      if (e.key === 'F3' && carrito.length) { e.preventDefault(); cobrar() }
      if (e.key === 'Escape') {
        if (busqueda) setBusqueda('')
        else if (carrito.length && confirm('¿Cancelar venta?')) cancelarVenta()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda, carrito, metodoPago, montoRecibido, modalPeso])

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => { if (modalPeso) setTimeout(() => inputPesoRef.current?.focus(), 50) }, [modalPeso])

  const subtotal = carrito.reduce((s, item) => s + item.precio_venta * item.cantidad, 0)
  const total = subtotal
  const recibido = parseFloat(montoRecibido) || 0
  const vuelto = metodoPago === 'efectivo' ? Math.max(0, recibido - total) : 0
  const efectivoFaltante = metodoPago === 'efectivo' && recibido > 0 && recibido < total

  // Click en producto: si es por peso abre modal, si es por unidad agrega 1
  const seleccionarProducto = (producto) => {
    if (producto.tipo_venta === 'peso') {
      setModalPeso({ producto, cantidad: '' })
      setBusqueda('')
      setResultados([])
      return
    }
    agregarUnidad(producto)
  }

  const agregarUnidad = (producto) => {
    setCarrito(prev => {
      const existe = prev.find(p => p.id === producto.id)
      if (existe) {
        if (existe.cantidad >= producto.stock) {
          toast.error(`Solo hay ${producto.stock} disponibles`)
          return prev
        }
        return prev.map(p => p.id === producto.id ? { ...p, cantidad: p.cantidad + 1 } : p)
      }
      return [...prev, { ...producto, cantidad: 1 }]
    })
    setBusqueda('')
    setResultados([])
    inputRef.current?.focus()
  }

  const confirmarPeso = () => {
    const cant = parseFloat(modalPeso.cantidad)
    if (!cant || cant <= 0) {
      toast.error('Ingresá un peso válido')
      return
    }
    if (cant > modalPeso.producto.stock) {
      toast.error(`Solo hay ${modalPeso.producto.stock} ${modalPeso.producto.unidad_medida}`)
      return
    }

    setCarrito(prev => {
      const existe = prev.find(p => p.id === modalPeso.producto.id)
      if (existe) {
        const nueva = existe.cantidad + cant
        if (nueva > modalPeso.producto.stock) {
          toast.error(`Stock insuficiente. Hay ${modalPeso.producto.stock} ${modalPeso.producto.unidad_medida}`)
          return prev
        }
        return prev.map(p => p.id === modalPeso.producto.id ? { ...p, cantidad: nueva } : p)
      }
      return [...prev, { ...modalPeso.producto, cantidad: cant }]
    })

    setModalPeso(null)
    inputRef.current?.focus()
  }

  const cambiarCantidad = (id, delta) => {
    setCarrito(prev => prev
      .map(p => {
        if (p.id !== id) return p
        // Para unidad: ±1; para peso: ±0.1
        const paso = p.tipo_venta === 'peso' ? 0.1 : 1
        const nueva = p.cantidad + (delta * paso)
        if (nueva > p.stock) {
          toast.error(`Solo hay ${p.stock} disponibles`)
          return p
        }
        return { ...p, cantidad: parseFloat(nueva.toFixed(3)) }
      })
      .filter(p => p.cantidad > 0)
    )
  }

  const eliminar = (id) => setCarrito(prev => prev.filter(p => p.id !== id))

  const cancelarVenta = () => {
    setCarrito([])
    setMontoRecibido('')
    setMetodoPago('efectivo')
    inputRef.current?.focus()
  }

  const cobrar = async () => {
    if (!carrito.length) return
    if (metodoPago === 'efectivo' && recibido < total) {
      toast.error('Monto recibido insuficiente')
      return
    }
    setCobrando(true)
    try {
      const resp = await ventasAPI.crear({
        metodo_pago: metodoPago,
        monto_recibido: metodoPago === 'efectivo' ? recibido : null,
        detalles: carrito.map(p => ({ producto_id: p.id, cantidad: p.cantidad })),
      })
      const msg = metodoPago === 'efectivo' && resp.vuelto > 0
        ? `Venta #${resp.id} · Vuelto: ${formatColones(resp.vuelto)}`
        : `Venta #${resp.id} registrada`
      toast.success(msg, { duration: 4000 })
      cancelarVenta()
    } catch (err) {
      toast.error(err.message || 'Error al registrar venta')
    } finally {
      setCobrando(false)
    }
  }

  const formatLineaCantidad = (item) => {
    if (item.tipo_venta === 'peso') {
      return `${Number(item.cantidad).toFixed(item.unidad_medida === 'g' ? 0 : 3)} ${item.unidad_medida}`
    }
    return Math.floor(item.cantidad)
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        {/* IZQUIERDA */}
        <div className="space-y-4">
          {/* Búsqueda */}
          <div className="card">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por código o nombre..."
                className="input-base w-full pl-10 text-base py-3"
                autoComplete="off"
              />
            </div>

            <div className="flex gap-2 mt-3 text-xs text-slate-500">
              <kbd className="px-2 py-0.5 bg-slate-100 rounded">F2 Buscar</kbd>
              <kbd className="px-2 py-0.5 bg-slate-100 rounded">F3 Cobrar</kbd>
              <kbd className="px-2 py-0.5 bg-slate-100 rounded">Esc Cancelar</kbd>
            </div>

            {resultados.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <div className="text-xs text-slate-500 mb-2">{resultados.length} resultado(s)</div>
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {resultados.map(p => {
                    const stockBajo = p.stock <= p.stock_minimo
                    return (
                      <button
                        key={p.id}
                        onClick={() => seleccionarProducto(p)}
                        className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-brand-50 rounded-lg transition-colors text-left group"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {p.tipo_venta === 'peso' && (
                            <Scale size={16} className="text-brand-500 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="font-medium text-sm text-slate-800 truncate">{p.nombre}</div>
                            <div className={`text-xs ${stockBajo ? 'text-amber-600' : 'text-slate-500'}`}>
                              {p.codigo || 'Sin código'} · Stock: {formatStock(p)}{stockBajo ? ' · bajo' : ''}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="font-medium text-slate-800 text-sm">{labelPrecio(p)}</div>
                          <div className="bg-brand-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg group-hover:bg-brand-700 transition-colors">
                            {p.tipo_venta === 'peso' ? 'Pesar' : '+ Agregar'}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {busqueda && resultados.length === 0 && (
              <div className="mt-3 text-sm text-slate-500 text-center py-4">
                Sin resultados para "{busqueda}"
              </div>
            )}
          </div>

          {/* Carrito */}
          <div className="card">
            <div className="flex justify-between items-center mb-3">
              <div className="text-xs font-semibold text-slate-500 tracking-wide">
                CARRITO · {carrito.length} producto{carrito.length !== 1 ? 's' : ''}
              </div>
              {carrito.length > 0 && (
                <button onClick={cancelarVenta} className="text-xs text-slate-500 hover:text-red-600">
                  Vaciar
                </button>
              )}
            </div>

            {carrito.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                El carrito está vacío.<br />Buscá productos para agregar.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {carrito.map(p => (
                  <div key={p.id} className="grid grid-cols-[1fr_120px_90px_30px] gap-2 items-center py-3">
                    <div className="min-w-0">
                      <div className="font-medium text-sm flex items-center gap-1.5">
                        {p.tipo_venta === 'peso' && <Scale size={12} className="text-brand-500 shrink-0" />}
                        <span className="truncate">{p.nombre}</span>
                      </div>
                      <div className="text-xs text-slate-500">
                        {labelPrecio(p)} × {formatLineaCantidad(p)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between bg-slate-100 rounded-lg px-2 py-1">
                      <button onClick={() => cambiarCantidad(p.id, -1)} className="text-slate-600 hover:text-slate-900 p-1">
                        <Minus size={14} />
                      </button>
                      <span className="font-medium text-xs">
                        {p.tipo_venta === 'peso'
                          ? Number(p.cantidad).toFixed(p.unidad_medida === 'g' ? 0 : 2)
                          : Math.floor(p.cantidad)}
                      </span>
                      <button onClick={() => cambiarCantidad(p.id, 1)} className="text-slate-600 hover:text-slate-900 p-1">
                        <Plus size={14} />
                      </button>
                    </div>
                    <div className="font-medium text-sm text-right">{formatColones(p.precio_venta * p.cantidad)}</div>
                    <button onClick={() => eliminar(p.id)} className="text-red-500 hover:text-red-700">
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* DERECHA: Cobro */}
        <div className="card sticky top-[88px] h-fit space-y-4">
          <div>
            <div className="text-xs text-slate-500">SUBTOTAL</div>
            <div className="font-medium text-slate-700">{formatColones(subtotal)}</div>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <div className="text-xs text-slate-500">TOTAL A PAGAR</div>
            <div className="text-4xl font-bold text-brand-600 leading-tight">{formatColones(total)}</div>
          </div>

          <div>
            <div className="text-xs font-medium text-slate-500 mb-2">MÉTODO DE PAGO</div>
            <div className="grid grid-cols-3 gap-1">
              {['efectivo', 'sinpe', 'tarjeta'].map(m => (
                <button
                  key={m}
                  onClick={() => setMetodoPago(m)}
                  className={`py-2 px-2 rounded-lg text-xs font-medium capitalize transition-colors ${
                    metodoPago === m
                      ? 'bg-brand-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >{m}</button>
              ))}
            </div>
          </div>

          {metodoPago === 'efectivo' && (
            <div>
              <div className="text-xs text-slate-500 mb-1">Recibido</div>
              <input
                type="number"
                value={montoRecibido}
                onChange={e => setMontoRecibido(e.target.value)}
                placeholder="0"
                className="input-base w-full text-right text-lg font-medium"
              />

              {efectivoFaltante && (
                <div className="mt-2 flex items-center gap-2 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                  <AlertCircle size={14} />
                  Faltan {formatColones(total - recibido)}
                </div>
              )}

              {recibido >= total && total > 0 && (
                <div className="mt-2 flex justify-between items-center bg-emerald-50 px-3 py-2 rounded-lg">
                  <span className="text-xs font-medium text-emerald-700">VUELTO</span>
                  <span className="font-bold text-emerald-800">{formatColones(vuelto)}</span>
                </div>
              )}
            </div>
          )}

          <button
            onClick={cobrar}
            disabled={!carrito.length || cobrando || (metodoPago === 'efectivo' && recibido < total)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white py-4 rounded-lg font-semibold text-lg transition-colors"
          >
            {cobrando ? 'Procesando...' : 'COBRAR (F3)'}
          </button>

          <button
            onClick={cancelarVenta}
            disabled={!carrito.length}
            className="w-full bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-600 py-2 rounded-lg text-sm transition-colors"
          >
            Cancelar venta (Esc)
          </button>
        </div>
      </div>

      {/* Modal de peso */}
      {modalPeso && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setModalPeso(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center">
                <Scale size={18} className="text-brand-600" />
              </div>
              <div>
                <div className="font-semibold">{modalPeso.producto.nombre}</div>
                <div className="text-xs text-slate-500">
                  {labelPrecio(modalPeso.producto)} · Disponible: {formatStock(modalPeso.producto)}
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500 mb-1 block">
                Cantidad a vender ({modalPeso.producto.unidad_medida})
              </label>
              <input
                ref={inputPesoRef}
                type="number"
                step="0.001"
                value={modalPeso.cantidad}
                onChange={e => setModalPeso({ ...modalPeso, cantidad: e.target.value })}
                onKeyDown={e => {
                  if (e.key === 'Enter') confirmarPeso()
                  if (e.key === 'Escape') setModalPeso(null)
                }}
                placeholder={modalPeso.producto.unidad_medida === 'kg' ? '1.5' : '500'}
                className="input-base w-full text-2xl text-center font-medium py-3"
              />

              {modalPeso.cantidad && parseFloat(modalPeso.cantidad) > 0 && (
                <div className="mt-3 bg-brand-50 px-4 py-3 rounded-lg flex justify-between items-baseline">
                  <span className="text-xs text-brand-700">Subtotal de esta línea</span>
                  <span className="text-xl font-bold text-brand-800">
                    {formatColones(parseFloat(modalPeso.cantidad) * modalPeso.producto.precio_venta)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setModalPeso(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={confirmarPeso} className="btn-primary flex-1">Agregar al carrito</button>
            </div>

            <div className="text-xs text-slate-400 text-center mt-3">Enter para confirmar · Esc para cancelar</div>
          </div>
        </div>
      )}
    </>
  )
}
