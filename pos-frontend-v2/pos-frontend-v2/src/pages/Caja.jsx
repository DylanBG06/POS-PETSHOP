import { useEffect, useState, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { Banknote, Smartphone, CreditCard, AlertCircle, Calendar, Clock, Trash2, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { cajaAPI, ventasAPI } from '../services/api'
import { formatColones, formatFechaHora, toDateInput } from '../utils/format'
import Modal from '../components/Modal'

export default function Caja() {
  const [resumen, setResumen] = useState(null)
  const [ventas, setVentas] = useState([])
  const [cierres, setCierres] = useState([])
  const [cargaInicial, setCargaInicial] = useState(true)
  const [refrescando, setRefrescando] = useState(false)
  const [modalCierre, setModalCierre] = useState(false)
  const [detalleVenta, setDetalleVenta] = useState(null)
  const location = useLocation()
  const inicialCargada = useRef(false)

  const cargar = useCallback(async (esRefresh = false) => {
    if (esRefresh) setRefrescando(true)
    try {
      const hoy = toDateInput(new Date())
      const [r, v, c] = await Promise.all([
        cajaAPI.resumenHoy(),
        ventasAPI.listar({ fecha_inicio: hoy, fecha_fin: hoy, limit: 100 }),
        cajaAPI.cierres(10),
      ])
      setResumen(r)
      setVentas(v)
      setCierres(c)
    } catch { toast.error('Error al cargar caja') }
    finally {
      setCargaInicial(false)
      setRefrescando(false)
    }
  }, [])

  // Cargar al entrar a la página (solo la primera vez por visita)
  useEffect(() => {
    if (!inicialCargada.current) {
      cargar(false)
      inicialCargada.current = true
    } else {
      cargar(true) // refresh silencioso al volver
    }
  }, [location.pathname, cargar])

  // Auto-refresh cada 5 minutos (silencioso, sin parpadeo)
  useEffect(() => {
    const t = setInterval(() => cargar(true), 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [cargar])

  const eliminarCierre = async (cierre) => {
    if (!confirm(`¿Eliminar cierre del ${formatFechaHora(cierre.fecha_cierre)}?`)) return
    try { await cajaAPI.eliminarCierre(cierre.id); toast.success('Cierre eliminado'); cargar(true) }
    catch (err) { toast.error(err.message) }
  }

  if (cargaInicial || !resumen) return <div className="text-center py-12 text-slate-400">Cargando...</div>

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="card bg-gradient-to-br from-brand-600 to-brand-700 text-white border-0">
          <div className="text-xs font-medium opacity-80">CAJA ACTUAL (desde último cierre)</div>
          <div className="text-4xl font-bold mt-1">{formatColones(resumen.total_dia)}</div>
          <div className="text-xs opacity-80 mt-2 flex items-center gap-1">
            <Calendar size={12} /> {new Date().toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>
        <div className="card">
          <div className="text-xs font-medium text-slate-500">VENTAS (desde último cierre)</div>
          <div className="text-4xl font-bold mt-1 text-slate-800">{resumen.cantidad_ventas}</div>
          <div className="text-xs text-slate-500 mt-2 flex items-center gap-1">
            <Clock size={12} /> Auto-refresh cada 5 min
          </div>
        </div>
      </div>

      <div className="card">
        <div className="text-xs font-semibold text-slate-500 tracking-wide mb-3">DESGLOSE POR MÉTODO DE PAGO</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <MetodoPagoCard icon={Banknote} label="Efectivo" valor={resumen.total_efectivo} total={resumen.total_dia} color="emerald" />
          <MetodoPagoCard icon={Smartphone} label="SINPE" valor={resumen.total_sinpe} total={resumen.total_dia} color="brand" />
          <MetodoPagoCard icon={CreditCard} label="Tarjeta" valor={resumen.total_tarjeta} total={resumen.total_dia} color="blue" />
        </div>
      </div>

      <div className="card bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="font-semibold text-amber-900 flex items-center gap-2"><AlertCircle size={16} /> Cierre de caja</div>
            <div className="text-xs text-amber-800 mt-1">Al cerrar, los valores se resetean a 0.</div>
          </div>
          <button onClick={() => setModalCierre(true)} disabled={resumen.cantidad_ventas === 0} className="bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors">
            Hacer cierre
          </button>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
          <div className="text-xs font-semibold text-slate-500 tracking-wide">VENTAS DEL DÍA ({ventas.length})</div>
          <button onClick={() => cargar(true)} disabled={refrescando} className="text-xs text-brand-600 hover:underline flex items-center gap-1 disabled:opacity-50">
            <RefreshCw size={12} className={refrescando ? 'animate-spin' : ''} />
            {refrescando ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="text-left py-2.5 px-3 font-medium">Hora</th>
                <th className="text-left py-2.5 px-3 font-medium">Items</th>
                <th className="text-left py-2.5 px-3 font-medium">Pago</th>
                <th className="text-right py-2.5 px-3 font-medium">Total</th>
                <th className="py-2.5 px-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ventas.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-slate-400">Sin ventas</td></tr>
              ) : ventas.map(v => (
                <tr key={v.id} className="hover:bg-slate-50/80">
                  <td className="py-2 px-3 text-xs tabular-nums">{new Date(v.fecha).toLocaleTimeString('es-CR',{hour:'2-digit',minute:'2-digit'})}</td>
                  <td className="py-2 px-3 text-xs">{v.detalles.length} producto{v.detalles.length!==1?'s':''}</td>
                  <td className="py-2 px-3"><span className="text-xs capitalize px-2 py-0.5 bg-slate-100 rounded">{v.metodo_pago}</span></td>
                  <td className="py-2 px-3 text-right font-medium">{formatColones(v.total)}</td>
                  <td className="py-2 px-3 text-right"><button onClick={() => setDetalleVenta(v)} className="text-xs text-brand-600 hover:underline">Ver</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {cierres.length > 0 && (
        <div className="card">
          <div className="text-xs font-semibold text-slate-500 tracking-wide mb-3">CIERRES ANTERIORES</div>
          <div className="space-y-2">
            {cierres.map(c => (
              <div key={c.id} className="grid grid-cols-[1fr_90px_90px_110px_30px] gap-2 items-center py-2 border-b border-slate-100 last:border-0 text-sm">
                <div><div className="font-medium">{formatFechaHora(c.fecha_cierre)}</div><div className="text-xs text-slate-500">{c.cantidad_ventas} ventas</div></div>
                <div className="text-right"><div className="text-xs text-slate-500">Esperado</div><div className="font-medium">{formatColones(c.total_esperado)}</div></div>
                <div className="text-right"><div className="text-xs text-slate-500">Real</div><div className="font-medium">{formatColones(c.total_real)}</div></div>
                <div className={`text-right px-2 py-1 rounded-md ${c.diferencia===0?'bg-emerald-50 text-emerald-700':c.diferencia>0?'bg-blue-50 text-blue-700':'bg-red-50 text-red-700'}`}>
                  <div className="text-xs">Diferencia</div>
                  <div className="font-semibold">{c.diferencia===0 ? 'OK' : c.diferencia>0 ? `+${formatColones(c.diferencia)}` : formatColones(c.diferencia)}</div>
                </div>
                <button onClick={() => eliminarCierre(c)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      <CierreModal open={modalCierre} onClose={() => setModalCierre(false)} resumen={resumen} onCerrar={() => { setModalCierre(false); cargar(true) }} />
      <DetalleVentaModal venta={detalleVenta} onClose={() => setDetalleVenta(null)} />
    </div>
  )
}

function MetodoPagoCard({ icon: Icon, label, valor, total, color }) {
  const pct = total>0?(valor/total)*100:0
  const c = { emerald:{bg:'bg-emerald-50',text:'text-emerald-700',icon:'text-emerald-600'}, brand:{bg:'bg-brand-50',text:'text-brand-700',icon:'text-brand-600'}, blue:{bg:'bg-blue-50',text:'text-blue-700',icon:'text-blue-600'} }[color]
  return (
    <div className={`${c.bg} rounded-xl p-3`}>
      <div className="flex items-center gap-2 mb-2"><Icon size={14} className={c.icon} /><span className="text-xs font-medium text-slate-700">{label}</span><span className="ml-auto text-xs text-slate-500">{pct.toFixed(0)}%</span></div>
      <div className={`text-xl font-bold ${c.text}`}>{formatColones(valor)}</div>
    </div>
  )
}

function CierreModal({ open, onClose, resumen, onCerrar }) {
  const [totalReal, setTotalReal] = useState('')
  const [notas, setNotas] = useState('')
  const [cerrando, setCerrando] = useState(false)
  const [confirmacionDif, setConfirmacionDif] = useState(false)

  useEffect(() => {
    if (open) { setTotalReal(''); setNotas(''); setConfirmacionDif(false) }
  }, [open])

  const real = parseFloat(totalReal) || 0
  const diferencia = real - resumen.total_efectivo
  const tieneDiferencia = totalReal !== '' && Math.abs(diferencia) > 0.01

  const intentarCerrar = () => {
    if (totalReal === '') return toast.error('Ingresá el total contado')
    // Si hay diferencia y aún no confirmó, mostrar advertencia
    if (tieneDiferencia && !confirmacionDif) {
      setConfirmacionDif(true)
      return
    }
    cerrarFinal()
  }

  const cerrarFinal = async () => {
    setCerrando(true)
    try {
      await cajaAPI.cerrar({ total_real: real, notas: notas.trim() || null })
      toast.success('Cierre registrado — valores reseteados')
      onCerrar()
    } catch (err) { toast.error(err.message) }
    finally { setCerrando(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Cierre de caja">
      <div className="space-y-4">
        <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Ventas en este turno</span><span className="font-medium">{resumen.cantidad_ventas}</span></div>
        </div>

        <div>
          <label className="text-xs text-slate-500 mb-1 block">Total efectivo contado en caja</label>
          <input
            type="number" value={totalReal}
            onChange={e => { setTotalReal(e.target.value); setConfirmacionDif(false) }}
            placeholder="0"
            className="input-base w-full text-2xl text-right font-medium py-3"
            autoFocus
          />
        </div>

        {/* Solo mostrar advertencia si hay diferencia Y ya intentó cerrar */}
        {confirmacionDif && tieneDiferencia && (
          <div className={`rounded-lg p-3 border ${diferencia > 0 ? 'bg-blue-50 border-blue-300 text-blue-900' : 'bg-red-50 border-red-300 text-red-900'}`}>
            <div className="font-semibold flex items-center gap-2 mb-1">
              <AlertCircle size={16} />
              {diferencia > 0 ? 'Hay un sobrante' : 'Hay un faltante'}
            </div>
            <div className="text-sm">
              {diferencia > 0
                ? `El monto contado tiene ${formatColones(diferencia)} de más.`
                : `Faltan ${formatColones(Math.abs(diferencia))} respecto a las ventas.`}
            </div>
            <div className="text-xs mt-2 opacity-80">
              Verificá el conteo. Si querés continuar, presioná "Confirmar cierre" otra vez.
            </div>
          </div>
        )}

        <div>
          <label className="text-xs text-slate-500 mb-1 block">Notas (opcional)</label>
          <textarea value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones del turno..." className="input-base w-full" rows={2} />
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={intentarCerrar} disabled={cerrando || totalReal === ''} className="btn-primary disabled:opacity-50">
            {cerrando ? 'Guardando...' : confirmacionDif ? 'Confirmar de todos modos' : 'Confirmar cierre'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function DetalleVentaModal({ venta, onClose }) {
  if (!venta) return null
  return (
    <Modal open={!!venta} onClose={onClose} title={`Venta #${venta.id}`}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><div className="text-xs text-slate-500">Fecha</div><div>{formatFechaHora(venta.fecha)}</div></div>
          <div><div className="text-xs text-slate-500">Pago</div><div className="capitalize">{venta.metodo_pago}</div></div>
        </div>
        <div className="border-t pt-3">{venta.detalles.map(d => (
          <div key={d.id} className="flex justify-between text-sm py-1.5 border-b border-slate-100 last:border-0">
            <div><div className="font-medium">{d.producto.nombre}</div><div className="text-xs text-slate-500">{Math.floor(d.cantidad)} × {formatColones(d.precio_unit)}</div></div>
            <div className="font-medium">{formatColones(d.subtotal)}</div>
          </div>
        ))}</div>
        <div className="border-t pt-3 flex justify-between items-baseline"><span className="text-slate-500">Total</span><span className="text-2xl font-bold text-brand-700">{formatColones(venta.total)}</span></div>
      </div>
    </Modal>
  )
}
