import { useEffect, useState, useCallback } from 'react'
import { Banknote, Smartphone, CreditCard, Calculator, AlertTriangle, CheckCircle2, Eye, Trash2, Gift, FileText, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { cajaAPI, ventasAPI } from '../services/api'
import { formatColones, formatFechaHora } from '../utils/format'
import Modal from '../components/Modal'

export default function Caja() {
  const [resumen, setResumen] = useState(null)
  const [apertura, setApertura] = useState(null)
  const [cierres, setCierres] = useState([])
  const [ventasHoy, setVentasHoy] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalApertura, setModalApertura] = useState(false)
  const [modalCierre, setModalCierre] = useState(false)
  const [detalleCierre, setDetalleCierre] = useState(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      // Fecha local de Costa Rica, no UTC
      const ahora = new Date()
      const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`
      const [r, c, v] = await Promise.all([
        cajaAPI.resumenHoy(),
        cajaAPI.cierres(10),
        ventasAPI.listar({ fecha_inicio: hoy, fecha_fin: hoy, limit: 500 }),
      ])
      setResumen(r)
      setCierres(c)
      // Solo ventas del turno actual: posteriores al último cierre
      const ultimoCierre = (c && c.length > 0) ? c[0] : null
      const fechaUltimoCierre = ultimoCierre ? new Date(ultimoCierre.fecha_cierre) : null
      const ventasTurnoActual = (v || []).filter(venta => {
        if (!fechaUltimoCierre) return true
        return new Date(venta.fecha) > fechaUltimoCierre
      })
      setVentasHoy(ventasTurnoActual)
      try {
        const a = await cajaAPI.aperturaHoy()
        setApertura(a)
      } catch {
        setApertura(null)
      }
    } catch (err) {
      console.error('Error caja:', err)
      toast.error(`Error: ${err?.message || err?.toString() || 'desconocido'}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargar()
    // Refrescar automáticamente cuando la pestaña vuelve a estar visible
    const onFocus = () => cargar()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [cargar])

  const verDetalle = async (cierre) => {
    try {
      const detalle = await cajaAPI.ventasDeCierre(cierre.id)
      // Combinar el cierre original con el detalle (por si falta algún campo)
      setDetalleCierre({ ...cierre, ...detalle })
    } catch (err) {
      console.error('Error cargando detalle del cierre:', err)
      toast.error('Error al cargar el detalle del cierre')
    }
  }

  const eliminarCierre = async (cierre) => {
    if (!confirm(`¿Eliminar este cierre del ${formatFechaHora(cierre.fecha_cierre)}? Esta acción no se puede deshacer.`)) return
    try {
      await cajaAPI.eliminarCierre(cierre.id)
      toast.success('Cierre eliminado')
      cargar()
    } catch (err) { toast.error(err.message) }
  }

  if (loading) {
    return <div className="text-center py-12 text-slate-400">Cargando...</div>
  }

  return (
    <div className="space-y-4">
      {!apertura ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-amber-600" size={20} />
            <div>
              <div className="font-medium text-amber-900">Caja no abierta</div>
              <div className="text-xs text-amber-700">Registrá el monto con el que iniciás el día</div>
            </div>
          </div>
          <button onClick={() => setModalApertura(true)} className="btn-primary">
            Abrir caja
          </button>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-emerald-600" size={20} />
            <div>
              <div className="font-medium text-emerald-900">Caja abierta · Apertura: {formatColones(apertura.monto)}</div>
              <div className="text-xs text-emerald-700">
                Desde {formatFechaHora(apertura.fecha)}
                {apertura.notas && ` · ${apertura.notas}`}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="VENTAS DEL TURNO" valor={formatColones(resumen?.total_dia || 0)} subtexto={`${resumen?.cantidad_ventas || 0} ventas`} />
        <StatCard label="EFECTIVO" valor={formatColones(resumen?.total_efectivo || 0)} icon={Banknote} variante="green" />
        <StatCard label="SINPE" valor={formatColones(resumen?.total_sinpe || 0)} icon={Smartphone} variante="blue" />
        <StatCard label="TARJETA" valor={formatColones(resumen?.total_tarjeta || 0)} icon={CreditCard} variante="purple" />
      </div>

      {(resumen?.monto_bonificado > 0 || resumen?.monto_descuentos > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {resumen.monto_bonificado > 0 && (
            <div className="bg-pink-50 border border-pink-200 rounded-lg p-3">
              <div className="text-xs font-medium text-pink-700 flex items-center gap-1"><Gift size={12} /> BONIFICADO (REGALÍAS)</div>
              <div className="text-lg font-bold text-pink-800">{formatColones(resumen.monto_bonificado)}</div>
            </div>
          )}
          {resumen.monto_descuentos > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <div className="text-xs font-medium text-emerald-700">DESCUENTOS APLICADOS</div>
              <div className="text-lg font-bold text-emerald-800">{formatColones(resumen.monto_descuentos)}</div>
            </div>
          )}
        </div>
      )}

      {apertura && resumen?.cantidad_ventas > 0 && (
        <div className="card flex items-center justify-between">
          <div>
            <div className="font-medium">¿Listo para cerrar el turno?</div>
            <div className="text-xs text-slate-500">Total esperado en caja: <strong>{formatColones(resumen.total_esperado_cierre)}</strong> ({formatColones(resumen.monto_apertura)} apertura + {formatColones(resumen.total_efectivo)} en efectivo)</div>
          </div>
          <button onClick={() => setModalCierre(true)} className="btn-primary flex items-center gap-2">
            <Calculator size={16} /> Hacer cierre
          </button>
        </div>
      )}

      <div className="card overflow-hidden p-0">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-700">Ventas de hoy</div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-500">{ventasHoy.length} venta{ventasHoy.length !== 1 ? 's' : ''}</div>
            <button onClick={cargar} className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded" title="Refrescar">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide sticky top-0">
              <tr>
                <th className="text-left py-2.5 px-3 font-medium">Hora</th>
                <th className="text-left py-2.5 px-3 font-medium">Productos</th>
                <th className="text-left py-2.5 px-3 font-medium">Método</th>
                <th className="text-right py-2.5 px-3 font-medium">Efectivo</th>
                <th className="text-right py-2.5 px-3 font-medium">SINPE</th>
                <th className="text-right py-2.5 px-3 font-medium">Tarjeta</th>
                <th className="text-right py-2.5 px-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ventasHoy.length === 0 ? (
                <tr><td colSpan={7} className="py-8 text-center text-slate-400">Sin ventas hoy</td></tr>
              ) : ventasHoy.map(v => {
                const items = v.detalle || []
                const tooltip = items.map(d => `${Math.floor(d.cantidad)}x ${d.nombre}${d.es_regalia ? ' (regalía)' : ''}`).join('\n')
                return (
                  <tr key={v.id} className="hover:bg-slate-50/80">
                    <td className="py-2 px-3 text-xs whitespace-nowrap">{formatFechaHora(v.fecha)}</td>
                    <td className="py-2 px-3 text-xs max-w-xs">
                      {items.length === 0 ? <span className="text-slate-400">—</span> : (
                        <div title={tooltip} className="truncate">
                          {items.map((d, i) => (
                            <span key={i}>
                              {i > 0 && ', '}
                              <span className={d.es_regalia ? 'text-pink-700' : ''}>
                                {Math.floor(d.cantidad)}× {d.nombre}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-xs capitalize">{v.metodo_pago}</td>
                    <td className="py-2 px-3 text-right text-xs">{v.monto_efectivo > 0 ? formatColones(v.monto_efectivo) : '—'}</td>
                    <td className="py-2 px-3 text-right text-xs">{v.monto_sinpe > 0 ? formatColones(v.monto_sinpe) : '—'}</td>
                    <td className="py-2 px-3 text-right text-xs">{v.monto_tarjeta > 0 ? formatColones(v.monto_tarjeta) : '—'}</td>
                    <td className="py-2 px-3 text-right font-medium">{formatColones(v.total)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="text-sm font-semibold text-slate-700">Historial de cierres</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="text-left py-2.5 px-3 font-medium">Fecha</th>
                <th className="text-right py-2.5 px-3 font-medium">Ventas</th>
                <th className="text-right py-2.5 px-3 font-medium">Efectivo</th>
                <th className="text-right py-2.5 px-3 font-medium">SINPE</th>
                <th className="text-right py-2.5 px-3 font-medium">Tarjeta</th>
                <th className="text-right py-2.5 px-3 font-medium">Diferencia</th>
                <th className="text-left py-2.5 px-3 font-medium">Notas</th>
                <th className="py-2.5 px-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cierres.length === 0 ? (
                <tr><td colSpan={8} className="py-8 text-center text-slate-400">Sin cierres registrados</td></tr>
              ) : cierres.map(c => (
                <tr key={c.id} className="hover:bg-slate-50/80">
                  <td className="py-2.5 px-3 text-xs">{formatFechaHora(c.fecha_cierre)}</td>
                  <td className="py-2.5 px-3 text-right">{c.cantidad_ventas}</td>
                  <td className="py-2.5 px-3 text-right text-xs">{formatColones(c.total_efectivo)}</td>
                  <td className="py-2.5 px-3 text-right text-xs">{formatColones(c.total_sinpe)}</td>
                  <td className="py-2.5 px-3 text-right text-xs">{formatColones(c.total_tarjeta)}</td>
                  <td className={`py-2.5 px-3 text-right font-medium ${c.diferencia === 0 ? 'text-slate-600' : c.diferencia > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {c.diferencia > 0 ? '+' : ''}{formatColones(c.diferencia)}
                  </td>
                  <td className="py-2.5 px-3 text-xs text-slate-600 max-w-[200px]">
                    {c.notas ? <div className="truncate" title={c.notas}>{c.notas}</div> : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => verDetalle(c)} className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded" title="Ver detalle">
                        <Eye size={14} />
                      </button>
                      <button onClick={() => eliminarCierre(c)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded" title="Eliminar">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AperturaModal open={modalApertura} onClose={() => setModalApertura(false)} onGuardar={() => { setModalApertura(false); cargar() }} />
      <CierreModal open={modalCierre} onClose={() => setModalCierre(false)} onGuardar={() => { setModalCierre(false); cargar() }} resumen={resumen} apertura={apertura} />
      <DetalleCierreModal detalle={detalleCierre} onClose={() => setDetalleCierre(null)} />
    </div>
  )
}

function StatCard({ label, valor, subtexto, icon: Icon, variante = 'normal' }) {
  const v = {
    normal: 'bg-white border-slate-200',
    green: 'bg-emerald-50 border-emerald-200',
    blue: 'bg-blue-50 border-blue-200',
    purple: 'bg-purple-50 border-purple-200',
  }
  const colors = {
    normal: 'text-slate-800',
    green: 'text-emerald-800',
    blue: 'text-blue-800',
    purple: 'text-purple-800',
  }
  return (
    <div className={`border rounded-xl p-3 ${v[variante]}`}>
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-slate-500">{label}</div>
        {Icon && <Icon size={14} className="text-slate-400" />}
      </div>
      <div className={`text-lg font-bold mt-1 ${colors[variante]}`}>{valor}</div>
      {subtexto && <div className="text-xs text-slate-500 mt-0.5">{subtexto}</div>}
    </div>
  )
}

function AperturaModal({ open, onClose, onGuardar }) {
  const [monto, setMonto] = useState('')
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { if (open) { setMonto(''); setNotas('') } }, [open])

  const guardar = async () => {
    const m = parseFloat(monto)
    if (isNaN(m) || m < 0) return toast.error('Monto inválido')
    setGuardando(true)
    try {
      await cajaAPI.registrarApertura({ monto: m, notas: notas.trim() || null })
      toast.success('Apertura registrada')
      onGuardar()
    } catch (err) { toast.error(err.message) }
    finally { setGuardando(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Abrir caja" maxWidth="max-w-md">
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">Monto inicial (₡)</label>
          <input type="number" min="0" value={monto} onChange={e => setMonto(e.target.value)}
            placeholder="0" className="input-base w-full text-right text-lg" autoFocus />
          <div className="text-xs text-slate-500 mt-1">Cantidad de efectivo con la que iniciás el día</div>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">Notas (opcional)</label>
          <textarea value={notas} onChange={e => setNotas(e.target.value)}
            placeholder="Ej: incluye 5000 en monedas, billete grande..." className="input-base w-full" rows={2} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={guardar} disabled={guardando} className="btn-primary disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Abrir caja'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function CierreModal({ open, onClose, onGuardar, resumen, apertura }) {
  const [totalReal, setTotalReal] = useState('')
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { if (open) { setTotalReal(''); setNotas('') } }, [open])

  if (!resumen) return null

  const real = parseFloat(totalReal) || 0
  const esperado = resumen.total_esperado_cierre || 0
  const diferencia = real - esperado
  const tieneInput = totalReal !== ''

  const guardar = async () => {
    if (!tieneInput) return toast.error('Ingresá el monto contado')
    if (real < 0) return toast.error('Monto inválido')
    setGuardando(true)
    try {
      await cajaAPI.cerrar({ total_real: real, notas: notas.trim() || null })
      toast.success('Cierre registrado')
      onGuardar()
    } catch (err) { toast.error(err.message) }
    finally { setGuardando(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Hacer cierre de caja" maxWidth="max-w-2xl">
      <div className="space-y-4">
        <div>
          <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Desglose del turno por método de pago</div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <Banknote size={14} /> EFECTIVO
              </div>
              <div className="text-xl font-bold text-emerald-800 mt-1">{formatColones(resumen.total_efectivo)}</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-blue-700">
                <Smartphone size={14} /> SINPE
              </div>
              <div className="text-xl font-bold text-blue-800 mt-1">{formatColones(resumen.total_sinpe)}</div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-purple-700">
                <CreditCard size={14} /> TARJETA
              </div>
              <div className="text-xl font-bold text-purple-800 mt-1">{formatColones(resumen.total_tarjeta)}</div>
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-500 text-center">
            Total ventas del turno: <strong className="text-slate-700">{formatColones(resumen.total_dia)}</strong> · {resumen.cantidad_ventas} venta{resumen.cantidad_ventas !== 1 ? 's' : ''}
          </div>
        </div>

        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
          <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Efectivo esperado en caja</div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Monto de apertura:</span>
              <span className="font-medium">{formatColones(resumen.monto_apertura)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">+ Ventas en efectivo:</span>
              <span className="font-medium">{formatColones(resumen.total_efectivo)}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-300 mt-1">
              <span className="font-semibold text-slate-700">Total esperado:</span>
              <span className="font-bold text-brand-700 text-lg">{formatColones(esperado)}</span>
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-500 block mb-2 uppercase tracking-wide">¿Cuánto efectivo contaste en caja?</label>
          <input type="number" min="0" value={totalReal} onChange={e => setTotalReal(e.target.value)}
            placeholder="0" className="input-base w-full text-right text-2xl font-bold py-3" autoFocus />
        </div>

        {tieneInput && (
          <div className={`rounded-lg p-3 border-2 ${diferencia === 0 ? 'bg-emerald-50 border-emerald-300' : Math.abs(diferencia) < 100 ? 'bg-amber-50 border-amber-300' : 'bg-red-50 border-red-300'}`}>
            <div className="flex justify-between items-center">
              <span className={`font-semibold ${diferencia === 0 ? 'text-emerald-700' : Math.abs(diferencia) < 100 ? 'text-amber-700' : 'text-red-700'}`}>
                {diferencia === 0 ? '✓ Caja cuadrada' : diferencia > 0 ? 'Sobrante' : 'Faltante'}:
              </span>
              <span className={`text-xl font-bold ${diferencia === 0 ? 'text-emerald-800' : Math.abs(diferencia) < 100 ? 'text-amber-800' : 'text-red-800'}`}>
                {diferencia > 0 ? '+' : ''}{formatColones(diferencia)}
              </span>
            </div>
            {diferencia !== 0 && (
              <div className="text-xs mt-1 text-slate-600">
                {diferencia > 0 ? 'Hay más efectivo del esperado.' : 'Falta efectivo en caja.'}
              </div>
            )}
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">Notas (opcional)</label>
          <textarea value={notas} onChange={e => setNotas(e.target.value)}
            placeholder="Observaciones del cierre..." className="input-base w-full" rows={2} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={guardar} disabled={guardando || !tieneInput} className="btn-primary disabled:opacity-50">
            {guardando ? 'Cerrando...' : 'Confirmar cierre'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function DetalleCierreModal({ detalle, onClose }) {
  if (!detalle) return null

  const safe = (n) => Number(n) || 0
  const diferencia = safe(detalle.diferencia)
  const productosVendidos = detalle.productos_vendidos || []

  return (
    <Modal open={!!detalle} onClose={onClose} title={`Detalle del cierre #${detalle.id || detalle.cierre_id || ''}`} maxWidth="max-w-3xl">
      <div className="space-y-4">
        <div className="text-xs text-slate-500">
          Cierre del {detalle.fecha_cierre ? formatFechaHora(detalle.fecha_cierre) : '—'} · {safe(detalle.cantidad_ventas)} venta{safe(detalle.cantidad_ventas) !== 1 ? 's' : ''}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <div className="text-xs font-medium text-emerald-700 flex items-center gap-1"><Banknote size={12} /> EFECTIVO</div>
            <div className="text-lg font-bold text-emerald-800">{formatColones(safe(detalle.total_efectivo))}</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="text-xs font-medium text-blue-700 flex items-center gap-1"><Smartphone size={12} /> SINPE</div>
            <div className="text-lg font-bold text-blue-800">{formatColones(safe(detalle.total_sinpe))}</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <div className="text-xs font-medium text-purple-700 flex items-center gap-1"><CreditCard size={12} /> TARJETA</div>
            <div className="text-lg font-bold text-purple-800">{formatColones(safe(detalle.total_tarjeta))}</div>
          </div>
        </div>

        <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-slate-600">Apertura:</span><span className="font-medium">{formatColones(safe(detalle.monto_apertura))}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Esperado:</span><span className="font-medium">{formatColones(safe(detalle.total_esperado))}</span></div>
          <div className="flex justify-between"><span className="text-slate-600">Contado:</span><span className="font-medium">{formatColones(safe(detalle.total_real))}</span></div>
          <div className={`flex justify-between pt-1 border-t border-slate-300 mt-1 ${diferencia === 0 ? 'text-slate-700' : diferencia > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            <span className="font-semibold">Diferencia:</span>
            <span className="font-bold">{diferencia > 0 ? '+' : ''}{formatColones(diferencia)}</span>
          </div>
          {safe(detalle.monto_bonificado) > 0 && (
            <div className="flex justify-between text-pink-700 pt-1 border-t border-slate-300 mt-1">
              <span className="flex items-center gap-1"><Gift size={12} /> Bonificado:</span>
              <span className="font-medium">{formatColones(safe(detalle.monto_bonificado))}</span>
            </div>
          )}
        </div>

        {detalle.notas && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1 flex items-center gap-1">
              <FileText size={12} /> Notas / observaciones
            </div>
            <div className="text-sm text-amber-900 whitespace-pre-wrap">{detalle.notas}</div>
          </div>
        )}

        {productosVendidos.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Productos vendidos en el turno</div>
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 sticky top-0">
                  <tr>
                    <th className="text-left py-2 px-3 font-medium">Producto</th>
                    <th className="text-right py-2 px-3 font-medium">Cantidad</th>
                    <th className="text-right py-2 px-3 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productosVendidos.map((p, i) => (
                    <tr key={i}>
                      <td className="py-1.5 px-3">
                        {p.nombre}
                        {safe(p.cantidad_regalia) > 0 && (
                          <span className="ml-2 text-xs text-pink-700">+{Math.floor(safe(p.cantidad_regalia))} regalía</span>
                        )}
                      </td>
                      <td className="py-1.5 px-3 text-right">{Math.floor(safe(p.cantidad))}</td>
                      <td className="py-1.5 px-3 text-right font-medium">{formatColones(safe(p.total))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button onClick={onClose} className="btn-secondary">Cerrar</button>
        </div>
      </div>
    </Modal>
  )
}
