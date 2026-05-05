import { useEffect, useRef, useState, useCallback } from 'react'
import { Search, Plus, Minus, X, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { productosAPI, ventasAPI } from '../services/api'
import { formatColones } from '../utils/format'

export default function Ventas() {
  const [busqueda, setBusqueda] = useState('')
  const [productos, setProductos] = useState([])
  const [carrito, setCarrito] = useState([])
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [montoRecibido, setMontoRecibido] = useState('')
  const [cobrando, setCobrando] = useState(false)
  const inputRef = useRef(null)

  // Cargar todos los productos al inicio
  const cargarProductos = useCallback(async () => {
    try {
      if (busqueda.trim()) {
        const res = await productosAPI.buscarRapido(busqueda)
        setProductos(res)
      } else {
        const res = await productosAPI.listar({ solo_activos: true })
        setProductos(res.filter(p => p.stock > 0))
      }
    } catch {
      setProductos([])
    }
  }, [busqueda])

  useEffect(() => {
    const timer = setTimeout(cargarProductos, 200)
    return () => clearTimeout(timer)
  }, [cargarProductos])

  useEffect(() => {
    const handler = (e) => {
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
  }, [busqueda, carrito, metodoPago, montoRecibido])

  useEffect(() => { inputRef.current?.focus() }, [])

  const subtotal = carrito.reduce((s, item) => s + item.precio_venta * item.cantidad, 0)
  const total = subtotal
  const recibido = parseFloat(montoRecibido) || 0
  const vuelto = metodoPago === 'efectivo' ? Math.max(0, recibido - total) : 0
  const efectivoFaltante = metodoPago === 'efectivo' && recibido > 0 && recibido < total

  const agregarProducto = (producto) => {
    setCarrito(prev => {
      const existe = prev.find(p => p.id === producto.id)
      if (existe) {
        if (existe.cantidad >= producto.stock) {
          toast.error(`Solo hay ${Math.floor(producto.stock)} disponibles`)
          return prev
        }
        return prev.map(p => p.id === producto.id ? { ...p, cantidad: p.cantidad + 1 } : p)
      }
      return [...prev, { ...producto, cantidad: 1 }]
    })
  }

  const cambiarCantidad = (id, delta) => {
    setCarrito(prev => prev
      .map(p => {
        if (p.id !== id) return p
        const nueva = p.cantidad + delta
        if (nueva > p.stock) {
          toast.error(`Solo hay ${Math.floor(p.stock)} disponibles`)
          return p
        }
        return { ...p, cantidad: nueva }
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
      cargarProductos() // Refrescar stock
    } catch (err) {
      toast.error(err.message || 'Error al registrar venta')
    } finally {
      setCobrando(false)
    }
  }

  return (
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
              placeholder="Buscar por código o nombre... (o ver todos abajo)"
              className="input-base w-full pl-10 text-base py-3"
              autoComplete="off"
            />
          </div>

          <div className="flex gap-2 mt-3 text-xs text-slate-500">
            <kbd className="px-2 py-0.5 bg-slate-100 rounded">F2 Buscar</kbd>
            <kbd className="px-2 py-0.5 bg-slate-100 rounded">F3 Cobrar</kbd>
            <kbd className="px-2 py-0.5 bg-slate-100 rounded">Esc Cancelar</kbd>
          </div>
        </div>

        {/* Catálogo de productos */}
        <div className="card">
          <div className="text-xs text-slate-500 mb-2">
            {busqueda ? `${productos.length} resultado(s)` : `${productos.length} productos disponibles`}
          </div>
          {productos.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">
              {busqueda ? `Sin resultados para "${busqueda}"` : 'No hay productos con stock disponible'}
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[450px] overflow-y-auto">
              {productos.map(p => {
                const enCarrito = carrito.find(c => c.id === p.id)
                const stockBajo = p.stock <= p.stock_minimo
                return (
                  <button
                    key={p.id}
                    onClick={() => agregarProducto(p)}
                    className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-brand-50 rounded-lg transition-colors text-left group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm text-slate-800 truncate">{p.nombre}</div>
                      <div className={`text-xs ${stockBajo ? 'text-amber-600' : 'text-slate-500'}`}>
                        {p.codigo || 'Sin código'} · Stock: {Math.floor(p.stock)}
                        {enCarrito ? ` · 🛒 ${enCarrito.cantidad} en carrito` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="font-medium text-slate-800 text-sm">{formatColones(p.precio_venta)}</div>
                      <div className="bg-brand-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg group-hover:bg-brand-700 transition-colors">
                        + Agregar
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Carrito */}
        {carrito.length > 0 && (
          <div className="card">
            <div className="flex justify-between items-center mb-3">
              <div className="text-xs font-semibold text-slate-500 tracking-wide">
                CARRITO · {carrito.length} producto{carrito.length !== 1 ? 's' : ''}
              </div>
              <button onClick={cancelarVenta} className="text-xs text-slate-500 hover:text-red-600">Vaciar</button>
            </div>

            <div className="divide-y divide-slate-100">
              {carrito.map(p => (
                <div key={p.id} className="grid grid-cols-[1fr_120px_90px_30px] gap-2 items-center py-3">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{p.nombre}</div>
                    <div className="text-xs text-slate-500">
                      {formatColones(p.precio_venta)} × {p.cantidad}
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-slate-100 rounded-lg px-2 py-1">
                    <button onClick={() => cambiarCantidad(p.id, -1)} className="text-slate-600 hover:text-slate-900 p-1">
                      <Minus size={14} />
                    </button>
                    <span className="font-medium text-xs">{p.cantidad}</span>
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
          </div>
        )}
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
                  metodoPago === m ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
                <AlertCircle size={14} /> Faltan {formatColones(total - recibido)}
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
  )
}
