import { useEffect, useState, useCallback } from 'react'
import { Banknote, Smartphone, CreditCard, AlertCircle, Calendar, RefreshCw, Trash2, LockOpen, Lock } from 'lucide-react'
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
  const [modalApertura, setModalApertura] = useState(false)
  const [modalCierre, setModalCierre] = useState(false)
  const [detalleVenta, setDetalleVenta] = useState(null)

  const cargar = useCallback(async (silencioso = false) => {
    if (silencioso) setRefrescando(true)
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
    } catch (err) {
      toast.error('Error al cargar caja')
      console.error(err)
    } finally {
      setCargaInicial(false)
      setRefrescando(false)
    }
  }, [])

  // Carga inicial
  useEffect(() => {
    cargar(false)
  }, [cargar])

  // Auto-refresh cada 5 minutos
  useEffect(() => {
    const t = setInterval(() => cargar(true), 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [cargar])

  const eliminarCierre = async (cierre) => {
    if (!confirm(`¿Eliminar cierre del ${formatFechaHora(cierre.fecha_cierre)}?`)) return
    try {
      await cajaAPI.eliminarCierre(cierre.id)
      toast.success('Cierre eliminado')
      cargar(true)
    } catch (err) { toast.error(err.message) }
  }

  if (cargaInicial) return <div className="text-center py-12 text-slate-400">Cargando...</div>
  if (!resumen) return <div className="text-center py-12 text-red-400">Error al cargar datos de caja</div>

  const sinApertura = !resumen.tiene_apertura

  return (
    <div className="space-y-4">

      {/* Banner de apertura */}
      {sinApertura && (
        <div className="bg-brand-50 border-2 border-brand-300 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-brand-100 rounded-full p-2">
              <LockOpen size={20} className="text-brand-600" />
            </div>
            <div>
              <div className="font-semibold text-brand-900">Registrá la apertura de caja</div>
              <div className="text-xs text-brand-700">Ingresá con cuánto dinero inicia la caja para que el cierre sea preciso</div>
            </div>
          </div>
          <button onClick={() => setModalApertura(true)} className="btn-primary shrink-0">
            Registrar apertura
          </button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className={`card ${sinApertura ? 'opacity-50' : ''}`}>
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs font-medium text-slate-500">APERTURA</div>
            <LockOpen size={14} className="text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-800">{formatColones(resumen.monto_apertura)}</div>
          <div className="text-xs text-slate-500 mt-1">{sinApertura ? 'Sin registrar' : 'Inicio del turno'}</div>
        </div>

        <div className="card bg-gradient-to-br from-brand-600 to-brand-700 text-white border-0">
          <div className="text-xs font-medium opacity-80">VENTAS DEL TURNO</div>
          <div className="text-3xl font-bold mt-1">{formatColones(resumen.total_dia)}</div>
          <div className="text-xs opacity-80 mt-1">{resumen.cantidad_ventas} venta{resumen.cantidad_ventas !== 1 ? 's' : ''}</div>
        </div>

        <div className="card border-emerald-200 bg-emerald-50">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs font-medium text-emerald-700">ESPERADO EN CAJA</div>
            <Lock size={14} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-800">{formatColones(resumen.total_esperado_cierre)}</div>
          <div className="text-xs text-emerald-700 mt-1">
            Apertura + efectivo
          </div>
        </div>
      </div>

      {/* Métodos de pago */}
      <div className="card">
        <div className="text-xs font-semibold text-slate-500 tracking-wide mb-3">VENTAS POR MÉTODO DE PAGO</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <MetodoCard icon={Banknote} label="Efectivo" valor={resumen.total_efectivo} total={resumen.total_dia} color="emerald" />
          <MetodoCard icon={Smartphone} label="SINPE" valor={resumen.total_sinpe} total={resumen.total_dia} color="brand" />
          <MetodoCard icon={CreditCard} label="Tarjeta" valor={resumen.total_tarjeta} total={resumen.total_dia} color="blue" />
        </div>
      </div>

      {/* Cierre */}
      <div className="card bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="font-semibold text-amber-900 flex items-center gap-2">
              <AlertCircle size={16} /> Cierre de caja
            </div>
            <div className="text-xs text-amber-800 mt-1">
              Se compara lo contado con {formatColones(resumen.total_esperado_cierre)} esperado. Los valores se resetean a 0.
            </div>
          </div>
          <div className="flex gap-2">
            {sinApertura && (
              <button onClick={() => setModalApertura(true)} className="btn-secondary text-sm">
                + Apertura
              </button>
            )}
            <button
              onClick={() => setModalCierre(true)}
              disabled={resumen.cantidad_ventas === 0}
              className="bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
            >
              Hacer cierre
            </button>
          </div>
        </div>
      </div>

      {/* Ventas del día */}
      <div className="card overflow-hidden p-0">
        <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
          <div className="text-xs font-semibold text-slate-500 tracking-wide flex items-center gap-2">
            <Calendar size={12} /> VENTAS DEL DÍA ({ventas.length})
          </div>
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
                <tr><td colSpan={5} className="py-8 text-center text-slate-400">Sin ventas aún</td></tr>
              ) : ventas.map(v => (
                <tr key={v.id} className="hover:bg-slate-50/80">
                  <td className="py-2 px-3 text-xs tabular-nums">
                    {new Date(v.fecha).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-2 px-3 text-xs">{v.detalles.length} producto{v.detalles.length !== 1 ? 's' : ''}</td>
                  <td className="py-2 px-3">
                    <span className="text-xs capitalize px-2 py-0.5 bg-slate-100 rounded">{v.metodo_pago}</span>
                  </td>
                  <td className="py-2 px-3 text-right font-medium">{formatColones(v.total)}</td>
                  <td className="py-2 px-3 text-right">
                    <button onClick={() => setDetalleVenta(v)} className="text-xs text-brand-600 hover:underline">Ver</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cierres anteriores */}
      {cierres.length > 0 && (
        <div className="card">
          <div className="text-xs font-semibold text-slate-500 tracking-wide mb-3">CIERRES ANTERIORES</div>
          <div className="space-y-2">
            {cierres.map(c => (
              <div key={c.id} className="bg-slate-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-medium text-sm">{formatFechaHora(c.fecha_cierre)}</div>
                    <div className="text-xs text-slate-500">
                      {c.cantidad_ventas} ventas · Apertura: {formatColones(c.monto_apertura || 0)}
                    </div>
                  </div>
                  <button onClick={() => eliminarCierre(c)} className="text-red-400 hover:text-red-600 p-1">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-white rounded p-2 text-center">
                    <div className="text-slate-500">Ventas efectivo</div>
                    <div className="font-semibold">{formatColones(c.total_ventas_efectivo || c.total_efectivo)}</div>
                  </div>
                  <div className="bg-white rounded p-2 text-center">
                    <div className="text-slate-500">Esperado total</div>
                    <div className="font-semibold">{formatColones(c.total_esperado)}</div>
                  </div>
                  <div className={`rounded p-2 text-center ${c.diferencia === 0 ? 'bg-emerald-100 text-emerald-800' : c.diferencia > 0 ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                    <div className="opacity-75">Diferencia</div>
                    <div className="font-bold">
                      {c.diferencia === 0 ? '✓ OK' : c.diferencia > 0 ? `+${formatColones(c.diferencia)}` : formatColones(c.diferencia)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <AperturaModal
        open={modalApertura}
        onClose={() => setModalApertura(false)}
        onGuardar={() => { setModalApertura(false); cargar(true) }}
      />
      <CierreModal
        open={modalCierre}
        onClose={() => setModalCierre(false)}
        resumen={resumen}
        onCerrar={() => { setModalCierre(false); cargar(false) }}
      />
      <DetalleVentaModal venta={detalleVenta} onClose={() => setDetalleVenta(null)} />
    </div>
  )
}

function MetodoCard({ icon: Icon, label, valor, total, color }) {
  const pct = total > 0 ? (valor / total) * 100 : 0
  const c = {
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', bar: 'bg-emerald-400', icon: 'text-emerald-600' },
    brand: { bg: 'bg-brand-50', text: 'text-brand-700', bar: 'bg-brand-400', icon: 'text-brand-600' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', bar: 'bg-blue-400', icon: 'text-blue-600' },
  }[color]
  return (
    <div className={`${c.bg} rounded-xl p-3`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className={c.icon} />
        <span className="text-xs font-medium text-slate-700">{label}</span>
        <span className="ml-auto text-xs text-slate-400">{pct.toFixed(0)}%</span>
      </div>
      <div className={`text-xl font-bold ${c.text}`}>{formatColones(valor)}</div>
      <div className="bg-white/60 h-1.5 rounded-full mt-2 overflow-hidden">
        <div className={`${c.bar} h-full rounded-full`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function AperturaModal({ open, onClose, onGuardar }) {
  const [monto, setMonto] = useState('')
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { if (open) { setMonto(''); setNotas('') } }, [open])

  const guardar = async () => {
    if (monto === '') return toast.error('Ingresá un monto (puede ser 0)')
    if (parseFloat(monto) < 0) return toast.error('El monto no puede ser negativo')
    setGuardando(true)
    try {
      await cajaAPI.registrarApertura({ monto: parseFloat(monto), notas: notas.trim() || null })
      toast.success(`Apertura registrada con ${formatColones(parseFloat(monto))}`)
      onGuardar()
    } catch (err) { toast.error(err.message) }
    finally { setGuardando(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Apertura de caja">
      <div className="space-y-4">
        <div className="bg-brand-50 border border-brand-200 rounded-lg p-3 text-sm text-brand-800">
          Registrá el dinero que hay en la caja <strong>antes de empezar a vender</strong>.
          Esto permite calcular con exactitud si el cierre cuadra.
        </div>

        <div>
          <label className="text-xs text-slate-500 mb-1 block">¿Con cuánto dinero inicia la caja? (₡)</label>
          <input
            type="number" min="0" step="100"
            value={monto}
            onChange={e => setMonto(e.target.value)}
            placeholder="0"
            className="input-base w-full text-3xl text-right font-bold py-4"
            autoFocus
          />
          <div className="text-xs text-slate-400 mt-1">Podés poner 0 si la caja empieza vacía</div>
        </div>

        <div>
          <label className="text-xs text-slate-500 mb-1 block">Notas (opcional)</label>
          <input
            type="text" value={notas}
            onChange={e => setNotas(e.target.value)}
            placeholder="Ej: Turno mañana, encargado Juan"
            className="input-base w-full"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={guardar} disabled={guardando || monto === ''} className="btn-primary disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Registrar apertura'}
          </button>
        </div>
      </div>
    </Modal>
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
  const diferencia = real - resumen.total_esperado_cierre
  const tieneDif = totalReal !== '' && Math.abs(diferencia) > 0.01

  const intentarCerrar = () => {
    if (totalReal === '') return toast.error('Ingresá el total contado')
    if (tieneDif && !confirmacionDif) { setConfirmacionDif(true); return }
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
        <div className="bg-slate-50 rounded-xl p-4 space-y-2">
          <div className="text-xs font-semibold text-slate-500 tracking-wide mb-3">RESUMEN DEL TURNO</div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Apertura</span>
            <span className="font-medium">{formatColones(resumen.monto_apertura)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Ventas efectivo</span>
            <span className="font-medium">+ {formatColones(resumen.total_efectivo)}</span>
          </div>
          <div className="flex justify-between text-sm text-slate-500">
            <span>Ventas SINPE (va a la cuenta, no a la caja)</span>
            <span>{formatColones(resumen.total_sinpe)}</span>
          </div>
          <div className="flex justify-between text-sm text-slate-500">
            <span>Ventas tarjeta</span>
            <span>{formatColones(resumen.total_tarjeta)}</span>
          </div>
          <div className="border-t border-slate-200 pt-2 flex justify-between">
            <span className="font-semibold text-slate-700">Esperado en caja</span>
            <span className="font-bold text-emerald-700 text-lg">{formatColones(resumen.total_esperado_cierre)}</span>
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-500 mb-1 block">Total efectivo contado en la caja</label>
          <input
            type="number" min="0" step="100"
            value={totalReal}
            onChange={e => { setTotalReal(e.target.value); setConfirmacionDif(false) }}
            placeholder="0"
            className="input-base w-full text-2xl text-right font-bold py-3"
            autoFocus
          />
        </div>

        {confirmacionDif && tieneDif && (
          <div className={`rounded-xl p-4 border-2 ${diferencia > 0 ? 'bg-blue-50 border-blue-300' : 'bg-red-50 border-red-300'}`}>
            <div className={`font-bold flex items-center gap-2 mb-1 ${diferencia > 0 ? 'text-blue-900' : 'text-red-900'}`}>
              <AlertCircle size={18} />
              {diferencia > 0 ? `Sobrante de ${formatColones(diferencia)}` : `Faltante de ${formatColones(Math.abs(diferencia))}`}
            </div>
            <div className={`text-sm ${diferencia > 0 ? 'text-blue-800' : 'text-red-800'}`}>
              Se esperaban {formatColones(resumen.total_esperado_cierre)} y contaste {formatColones(real)}.
              Verificá el conteo antes de confirmar.
            </div>
          </div>
        )}

        <div>
          <label className="text-xs text-slate-500 mb-1 block">Notas (opcional)</label>
          <textarea
            value={notas} onChange={e => setNotas(e.target.value)}
            placeholder="Observaciones del turno..."
            className="input-base w-full" rows={2}
          />
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
        <div className="border-t pt-3">
          {venta.detalles.map(d => (
            <div key={d.id} className="flex justify-between text-sm py-1.5 border-b border-slate-100 last:border-0">
              <div>
                <div className="font-medium">{d.producto.nombre}</div>
                <div className="text-xs text-slate-500">{Math.floor(d.cantidad)} × {formatColones(d.precio_unit)}</div>
              </div>
              <div className="font-medium">{formatColones(d.subtotal)}</div>
            </div>
          ))}
        </div>
        <div className="border-t pt-3 flex justify-between items-baseline">
          <span className="text-slate-500">Total</span>
          <span className="text-2xl font-bold text-brand-700">{formatColones(venta.total)}</span>
        </div>
      </div>
    </Modal>
  )
}
