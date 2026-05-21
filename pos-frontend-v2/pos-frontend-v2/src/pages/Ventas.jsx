import { useEffect, useRef, useState, useCallback } from 'react'
import { Search, Plus, Minus, X, AlertCircle, Gift, Banknote, Smartphone, CreditCard, SplitSquareVertical } from 'lucide-react'
import toast from 'react-hot-toast'
import { productosAPI, ventasAPI } from '../services/api'
import { formatColones } from '../utils/format'

export default function Ventas() {
  const [busqueda, setBusqueda] = useState('')
  const [productos, setProductos] = useState([])
  const [carrito, setCarrito] = useState([])
  const [pagoDividido, setPagoDividido] = useState(false)
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [montoEfectivo, setMontoEfectivo] = useState('')
  const [montoSinpe, setMontoSinpe] = useState('')
  const [montoTarjeta, setMontoTarjeta] = useState('')
  const [montoRecibido, setMontoRecibido] = useState('')
  const [cobrando, setCobrando] = useState(false)
  const inputRef = useRef(null)

  const cargarProductos = useCallback(async () => {
    try {
      if (busqueda.trim()) {
        const res = await productosAPI.buscarRapido(busqueda)
        setProductos(res)
      } else {
        const res = await productosAPI.listar({ solo_activos: true })
        setProductos(res.filter(p => p.stock > 0))
      }
    } catch { setProductos([]) }
  }, [busqueda])

  useEffect(() => {
    const t = setTimeout(cargarProductos, 200)
    return () => clearTimeout(t)
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
  }, [busqueda, carrito, metodoPago, montoRecibido, pagoDividido, montoEfectivo, montoSinpe, montoTarjeta])

  useEffect(() => { inputRef.current?.focus() }, [])

  // Calcular totales
  const subtotal = carrito.reduce((s, item) => {
    if (item.es_regalia) return s
    return s + item.precio_venta * item.cantidad
  }, 0)
  const totalDescuentos = carrito.reduce((s, item) => {
    if (item.es_regalia) return s
    const base = item.precio_venta * item.cantidad
    const dm = parseFloat(item.descuento_monto) || 0
    const dp = parseFloat(item.descuento_pct) || 0
    return s + Math.min(base, dm + base * dp / 100)
  }, 0)
  const valorRegalado = carrito.reduce((s, item) => {
    if (!item.es_regalia) return s
    return s + item.precio_venta * item.cantidad
  }, 0)
  const total = Math.max(0, subtotal - totalDescuentos)

  // Montos para el cálculo
  const efe = parseFloat(montoEfectivo) || 0
  const sin = parseFloat(montoSinpe) || 0
  const tar = parseFloat(montoTarjeta) || 0
  const sumaPagos = pagoDividido ? (efe + sin + tar) : (
    metodoPago === 'efectivo' ? total :
    metodoPago === 'sinpe' ? total :
    metodoPago === 'tarjeta' ? total : 0
  )
  const recibido = parseFloat(montoRecibido) || 0
  // En modo dividido el efectivo viene de montoEfectivo, en modo simple de montoRecibido
  const efectivoCobrar = pagoDividido ? efe : (metodoPago === 'efectivo' ? total : 0)
  const vuelto = efectivoCobrar > 0 && recibido > efectivoCobrar ? recibido - efectivoCobrar : 0
  const efectivoFaltante = efectivoCobrar > 0 && recibido > 0 && recibido < efectivoCobrar
  const sumaCorrecta = Math.abs(sumaPagos - total) < 0.01

  const agregarProducto = (producto) => {
    setCarrito(prev => {
      const existe = prev.find(p => p.id === producto.id && !p.es_regalia)
      if (existe) {
        if (existe.cantidad >= producto.stock) {
          toast.error(`Solo hay ${Math.floor(producto.stock)} disponibles`)
          return prev
        }
        return prev.map(p => (p.id === producto.id && !p.es_regalia) ? { ...p, cantidad: p.cantidad + 1 } : p)
      }
      return [...prev, { ...producto, cantidad: 1, es_regalia: false, descuento_monto: '', descuento_pct: '' }]
    })
  }

  const cambiarCantidad = (item, delta) => {
    setCarrito(prev => prev.map(p => {
      if (p === item) {
        const nueva = p.cantidad + delta
        if (nueva > p.stock) { toast.error(`Solo hay ${Math.floor(p.stock)} disponibles`); return p }
        return { ...p, cantidad: nueva }
      }
      return p
    }).filter(p => p.cantidad > 0))
  }

  const eliminar = (item) => setCarrito(prev => prev.filter(p => p !== item))
  const toggleRegalia = (item) => setCarrito(prev => prev.map(p => p === item ? { ...p, es_regalia: !p.es_regalia } : p))

  const cancelarVenta = () => {
    setCarrito([])
    setMontoRecibido('')
    setMontoEfectivo(''); setMontoSinpe(''); setMontoTarjeta('')
    setMetodoPago('efectivo')
    setPagoDividido(false)
    inputRef.current?.focus()
  }

  const cobrar = async () => {
    if (!carrito.length) return
    if (pagoDividido) {
      if (!sumaCorrecta) {
        toast.error(`La suma debe ser ₡${total.toLocaleString()}. Suma actual: ₡${sumaPagos.toLocaleString()}`)
        return
      }
    } else {
      if (metodoPago === 'efectivo' && recibido < total) {
        toast.error('Monto recibido insuficiente')
        return
      }
    }
    if (efectivoCobrar > 0 && montoRecibido && recibido < efectivoCobrar) {
      toast.error('Monto recibido insuficiente para cubrir el efectivo')
      return
    }

    setCobrando(true)
    try {
      const payload = {
        detalles: carrito.map(p => ({
          producto_id: p.id,
          cantidad: p.cantidad,
          es_regalia: p.es_regalia,
          descuento_monto: parseFloat(p.descuento_monto) || 0,
          descuento_porcentaje: parseFloat(p.descuento_pct) || 0,
        })),
        monto_recibido: efectivoCobrar > 0 && recibido > 0 ? recibido : null,
      }
      if (pagoDividido) {
        payload.monto_efectivo = efe
        payload.monto_sinpe = sin
        payload.monto_tarjeta = tar
      } else {
        payload.metodo_pago = metodoPago
        if (metodoPago === 'efectivo') payload.monto_efectivo = total
        else if (metodoPago === 'sinpe') payload.monto_sinpe = total
        else if (metodoPago === 'tarjeta') payload.monto_tarjeta = total
      }

      const resp = await ventasAPI.crear(payload)
      const msg = resp.vuelto > 0
        ? `Venta #${resp.id} · Vuelto: ${formatColones(resp.vuelto)}`
        : `Venta #${resp.id} registrada`
      toast.success(msg, { duration: 4000 })
      cancelarVenta()
      cargarProductos()
    } catch (err) {
      toast.error(err.message || 'Error al registrar venta')
    } finally {
      setCobrando(false)
    }
  }

  const restanteParaDividir = Math.max(0, total - sumaPagos)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4">
      <div className="space-y-4">
        <div className="card">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={inputRef} type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por código o nombre..."
              className="input-base w-full pl-10 text-base py-3" autoComplete="off"
            />
          </div>
          <div className="flex gap-2 mt-3 text-xs text-slate-500">
            <kbd className="px-2 py-0.5 bg-slate-100 rounded">F2 Buscar</kbd>
            <kbd className="px-2 py-0.5 bg-slate-100 rounded">F3 Cobrar</kbd>
            <kbd className="px-2 py-0.5 bg-slate-100 rounded">Esc Cancelar</kbd>
          </div>
        </div>

        <div className="card">
          <div className="text-xs text-slate-500 mb-2">
            {busqueda ? `${productos.length} resultado(s)` : `${productos.length} productos disponibles`}
          </div>
          {productos.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">
              {busqueda ? `Sin resultados para "${busqueda}"` : 'No hay productos con stock'}
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[450px] overflow-y-auto">
              {productos.map(p => (
                <button key={p.id} onClick={() => agregarProducto(p)}
                  className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-brand-50 rounded-lg transition-colors text-left">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm text-slate-800 truncate">{p.nombre}</div>
                    <div className="text-xs text-slate-500">
                      {p.codigo || 'Sin código'} · Stock: {Math.floor(p.stock)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="font-medium text-slate-800 text-sm">{formatColones(p.precio_venta)}</div>
                    <div className="bg-brand-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg">+ Agregar</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {carrito.length > 0 && (
          <div className="card">
            <div className="flex justify-between items-center mb-3">
              <div className="text-xs font-semibold text-slate-500 tracking-wide">
                CARRITO · {carrito.length} producto{carrito.length !== 1 ? 's' : ''}
              </div>
              <button onClick={cancelarVenta} className="text-xs text-slate-500 hover:text-red-600">Vaciar</button>
            </div>

            <div className="divide-y divide-slate-100">
              {carrito.map((p, idx) => {
                const baseItem = p.precio_venta * p.cantidad
                const dm = parseFloat(p.descuento_monto) || 0
                const dp = parseFloat(p.descuento_pct) || 0
                const descItem = Math.min(baseItem, dm + baseItem * dp / 100)
                const subtotalItem = p.es_regalia ? 0 : Math.max(0, baseItem - descItem)
                return (
                  <div key={idx} className={`py-3 ${p.es_regalia ? 'bg-pink-50/50 -mx-2 px-2 rounded-lg' : ''}`}>
                    <div className="grid grid-cols-[1fr_100px_120px_80px_30px] gap-2 items-center">
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate flex items-center gap-1.5">
                          {p.es_regalia && <Gift size={12} className="text-pink-600" />}
                          {p.nombre}
                        </div>
                        <div className="text-xs text-slate-500">
                          {p.es_regalia ? <span className="text-pink-700 font-medium">REGALÍA</span> : `${formatColones(p.precio_venta)} × ${p.cantidad}`}
                        </div>
                      </div>
                      <button onClick={() => toggleRegalia(p)}
                        className={`text-xs px-2 py-1 rounded font-medium transition-colors ${p.es_regalia ? 'bg-pink-200 text-pink-800 hover:bg-pink-300' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>
                        {p.es_regalia ? '✓ Regalía' : '🎁 Regalo'}
                      </button>
                      <div className="flex items-center justify-between bg-slate-100 rounded-lg px-2 py-1">
                        <button onClick={() => cambiarCantidad(p, -1)} className="text-slate-600 p-1"><Minus size={14} /></button>
                        <span className="font-medium text-xs">{p.cantidad}</span>
                        <button onClick={() => cambiarCantidad(p, 1)} className="text-slate-600 p-1"><Plus size={14} /></button>
                      </div>
                      <div className={`font-medium text-sm text-right ${p.es_regalia ? 'text-pink-700' : ''}`}>
                        {p.es_regalia ? 'GRATIS' : formatColones(subtotalItem)}
                      </div>
                      <button onClick={() => eliminar(p)} className="text-red-500"><X size={16} /></button>
                    </div>
                    {!p.es_regalia && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-slate-400 w-16 shrink-0">Desc. item:</span>
                        <input type="number" min="0" value={p.descuento_monto}
                          onChange={e => setCarrito(prev => prev.map((c, i) => i === idx ? { ...c, descuento_monto: e.target.value } : c))}
                          placeholder="₡ monto" className="input-base text-xs py-1 w-24" />
                        <input type="number" min="0" max="100" value={p.descuento_pct}
                          onChange={e => setCarrito(prev => prev.map((c, i) => i === idx ? { ...c, descuento_pct: e.target.value } : c))}
                          placeholder="% pct" className="input-base text-xs py-1 w-20" />
                        {descItem > 0 && <span className="text-xs text-emerald-700 font-medium">-{formatColones(descItem)}</span>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* PANEL DERECHO */}
      <div className="card sticky top-[88px] h-fit space-y-3">
        <div>
          <div className="text-xs text-slate-500">SUBTOTAL</div>
          <div className="font-medium text-slate-700">{formatColones(subtotal)}</div>
        </div>

        {totalDescuentos > 0 && (
          <div className="text-xs text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">
            Descuento total: -{formatColones(totalDescuentos)}
          </div>
        )}

        {valorRegalado > 0 && (
          <div className="bg-pink-50 border border-pink-200 rounded-lg p-2 text-xs text-pink-800 flex items-center gap-1.5">
            <Gift size={12} /> Regalando productos por {formatColones(valorRegalado)}
          </div>
        )}

        <div className="border-t border-slate-100 pt-3">
          <div className="text-xs text-slate-500">TOTAL A PAGAR</div>
          <div className="text-4xl font-bold text-brand-600 leading-tight">{formatColones(total)}</div>
        </div>

        {/* Toggle pago dividido */}
        <button onClick={() => setPagoDividido(!pagoDividido)}
          className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-colors ${pagoDividido ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          <SplitSquareVertical size={14} />
          {pagoDividido ? '✓ Pago dividido activado' : 'Pago dividido (cliente paga con varios métodos)'}
        </button>

        {!pagoDividido ? (
          // ─── MODO SIMPLE ───
          <>
            <div>
              <div className="text-xs font-medium text-slate-500 mb-2">MÉTODO DE PAGO</div>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { m: 'efectivo', icon: Banknote, label: 'Efectivo' },
                  { m: 'sinpe', icon: Smartphone, label: 'SINPE' },
                  { m: 'tarjeta', icon: CreditCard, label: 'Tarjeta' },
                ].map(({ m, icon: Icon, label }) => (
                  <button key={m} onClick={() => setMetodoPago(m)}
                    className={`py-2 px-2 rounded-lg text-xs font-medium transition-colors flex flex-col items-center gap-1 ${metodoPago === m ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <Icon size={14} />{label}
                  </button>
                ))}
              </div>
            </div>

            {metodoPago === 'efectivo' && (
              <div>
                <div className="text-xs text-slate-500 mb-1">Recibido</div>
                <input type="number" value={montoRecibido} onChange={e => setMontoRecibido(e.target.value)}
                  placeholder="0" className="input-base w-full text-right text-lg font-medium" />
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
          </>
        ) : (
          // ─── MODO DIVIDIDO ───
          <div className="space-y-2 bg-brand-50 rounded-lg p-3 border border-brand-200">
            <div className="text-xs font-medium text-brand-700 mb-2">DIVIDIR EL PAGO</div>

            <div>
              <label className="text-xs text-slate-600 flex items-center gap-1 mb-1">
                <Banknote size={12} /> Efectivo
              </label>
              <input type="number" min="0" value={montoEfectivo} onChange={e => setMontoEfectivo(e.target.value)}
                placeholder="0" className="input-base w-full text-right text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-600 flex items-center gap-1 mb-1">
                <Smartphone size={12} /> SINPE
              </label>
              <input type="number" min="0" value={montoSinpe} onChange={e => setMontoSinpe(e.target.value)}
                placeholder="0" className="input-base w-full text-right text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-600 flex items-center gap-1 mb-1">
                <CreditCard size={12} /> Tarjeta
              </label>
              <input type="number" min="0" value={montoTarjeta} onChange={e => setMontoTarjeta(e.target.value)}
                placeholder="0" className="input-base w-full text-right text-sm" />
            </div>

            <div className={`flex justify-between items-center pt-2 border-t border-brand-200 text-sm ${sumaCorrecta ? 'text-emerald-700' : 'text-amber-700'}`}>
              <span className="font-medium">Suma:</span>
              <span className="font-bold">{formatColones(sumaPagos)}</span>
            </div>
            {!sumaCorrecta && restanteParaDividir > 0 && (
              <div className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
                Falta: {formatColones(restanteParaDividir)}
              </div>
            )}
            {!sumaCorrecta && sumaPagos > total && (
              <div className="text-xs text-red-700 bg-red-50 px-2 py-1 rounded">
                Excede en: {formatColones(sumaPagos - total)}
              </div>
            )}

            {efe > 0 && (
              <div className="pt-2 border-t border-brand-200">
                <label className="text-xs text-slate-600 mb-1 block">Efectivo recibido (para vuelto)</label>
                <input type="number" value={montoRecibido} onChange={e => setMontoRecibido(e.target.value)}
                  placeholder={efe.toString()} className="input-base w-full text-right text-sm" />
                {recibido >= efe && recibido > 0 && vuelto > 0 && (
                  <div className="mt-1 flex justify-between text-xs bg-emerald-50 px-2 py-1 rounded">
                    <span className="text-emerald-700 font-medium">Vuelto:</span>
                    <span className="font-bold text-emerald-800">{formatColones(vuelto)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <button onClick={cobrar}
          disabled={!carrito.length || cobrando || (pagoDividido ? !sumaCorrecta : (metodoPago === 'efectivo' && recibido < total))}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white py-4 rounded-lg font-semibold text-lg transition-colors">
          {cobrando ? 'Procesando...' : 'COBRAR (F3)'}
        </button>

        <button onClick={cancelarVenta} disabled={!carrito.length}
          className="w-full bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-600 py-2 rounded-lg text-sm">
          Cancelar venta (Esc)
        </button>
      </div>
    </div>
  )
}
