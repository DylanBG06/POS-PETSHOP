import { useEffect, useState } from 'react'
import { Banknote, Smartphone, CreditCard, ShoppingCart, AlertCircle, Check, X, Calendar, Clock, Scale } from 'lucide-react'
import toast from 'react-hot-toast'
import { cajaAPI, ventasAPI } from '../services/api'
import { formatColones, formatFechaHora, toDateInput, formatCantidad } from '../utils/format'
import Modal from '../components/Modal'

export default function Caja() {
  const [resumen, setResumen] = useState(null)
  const [ventas, setVentas] = useState([])
  const [cierres, setCierres] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalCierre, setModalCierre] = useState(false)
  const [detalleVenta, setDetalleVenta] = useState(null)

  const cargar = async () => {
    setLoading(true)
    try {
      const hoy = toDateInput(new Date())
      const [r, v, c] = await Promise.all([
        cajaAPI.resumenHoy(),
        ventasAPI.listar({ fecha_inicio: hoy, fecha_fin: hoy, limit: 100 }),
        cajaAPI.cierres(7),
      ])
      setResumen(r)
      setVentas(v)
      setCierres(c)
    } catch (err) {
      toast.error('Error al cargar datos de caja')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargar()
    const t = setInterval(cargar, 30000)
    return () => clearInterval(t)
  }, [])

  if (loading || !resumen) {
    return <div className="text-center py-12 text-slate-400">Cargando...</div>
  }

  return (
    <div className="space-y-4">
      {/* KPIs principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="card bg-gradient-to-br from-brand-600 to-brand-700 text-white border-0">
          <div className="text-xs font-medium opacity-80">CAJA DE HOY</div>
          <div className="text-4xl font-bold mt-1">{formatColones(resumen.total_dia)}</div>
          <div className="text-xs opacity-80 mt-2 flex items-center gap-1">
            <Calendar size={12} /> {new Date().toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>

        <div className="card">
          <div className="text-xs font-medium text-slate-500">VENTAS HOY</div>
          <div className="text-4xl font-bold mt-1 text-slate-800">{resumen.cantidad_ventas}</div>
          <div className="text-xs text-slate-500 mt-2 flex items-center gap-1">
            <Clock size={12} /> Última actualización: {new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {/* Por método de pago */}
      <div className="card">
        <div className="text-xs font-semibold text-slate-500 tracking-wide mb-3">DESGLOSE POR MÉTODO DE PAGO</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <MetodoPagoCard
            icon={Banknote}
            label="Efectivo"
            valor={resumen.total_efectivo}
            total={resumen.total_dia}
            color="emerald"
          />
          <MetodoPagoCard
            icon={Smartphone}
            label="SINPE Móvil"
            valor={resumen.total_sinpe}
            total={resumen.total_dia}
            color="brand"
          />
          <MetodoPagoCard
            icon={CreditCard}
            label="Tarjeta"
            valor={resumen.total_tarjeta}
            total={resumen.total_dia}
            color="blue"
          />
        </div>
      </div>

      {/* Acción de cierre */}
      <div className="card bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="font-semibold text-amber-900 flex items-center gap-2">
              <AlertCircle size={16} /> Cierre de caja
            </div>
            <div className="text-xs text-amber-800 mt-1">
              Hacé el cierre al final del día para verificar que el efectivo coincida con lo registrado.
            </div>
          </div>
          <button
            onClick={() => setModalCierre(true)}
            disabled={resumen.cantidad_ventas === 0}
            className="bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
          >
            Hacer cierre de caja
          </button>
        </div>
      </div>

      {/* Ventas de hoy */}
      <div className="card overflow-hidden p-0">
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="text-xs font-semibold text-slate-500 tracking-wide">VENTAS DEL DÍA</div>
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
                <tr><td colSpan={5} className="py-8 text-center text-slate-400">Aún no hay ventas hoy</td></tr>
              ) : ventas.map(v => (
                <tr key={v.id} className="hover:bg-slate-50/80">
                  <td className="py-2 px-3 text-xs text-slate-600 tabular-nums">
                    {new Date(v.fecha).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-2 px-3 text-xs">{v.detalles.length} producto{v.detalles.length !== 1 ? 's' : ''}</td>
                  <td className="py-2 px-3">
                    <span className="text-xs capitalize px-2 py-0.5 bg-slate-100 rounded">{v.metodo_pago}</span>
                  </td>
                  <td className="py-2 px-3 text-right font-medium">{formatColones(v.total)}</td>
                  <td className="py-2 px-3 text-right">
                    <button
                      onClick={() => setDetalleVenta(v)}
                      className="text-xs text-brand-600 hover:underline"
                    >Ver</button>
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
              <div key={c.id} className="grid grid-cols-[1fr_100px_100px_120px] gap-3 items-center py-2 border-b border-slate-100 last:border-0 text-sm">
                <div>
                  <div className="font-medium">{formatFechaHora(c.fecha_cierre)}</div>
                  <div className="text-xs text-slate-500">{c.cantidad_ventas} ventas</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Esperado</div>
                  <div className="font-medium">{formatColones(c.total_esperado)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Real</div>
                  <div className="font-medium">{formatColones(c.total_real)}</div>
                </div>
                <div className={`text-right px-3 py-1 rounded-md ${
                  c.diferencia === 0 ? 'bg-emerald-50 text-emerald-700' :
                  c.diferencia > 0 ? 'bg-blue-50 text-blue-700' :
                  'bg-red-50 text-red-700'
                }`}>
                  <div className="text-xs">Diferencia</div>
                  <div className="font-semibold flex items-center justify-end gap-1">
                    {c.diferencia === 0 ? <Check size={14} /> : c.diferencia > 0 ? '+' : ''}
                    {c.diferencia !== 0 && formatColones(Math.abs(c.diferencia))}
                    {c.diferencia === 0 && 'Cuadrado'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal cierre */}
      <CierreModal
        open={modalCierre}
        onClose={() => setModalCierre(false)}
        resumen={resumen}
        onCerrar={() => { setModalCierre(false); cargar() }}
      />

      {/* Detalle venta */}
      <DetalleVentaModal
        venta={detalleVenta}
        onClose={() => setDetalleVenta(null)}
      />
    </div>
  )
}

function MetodoPagoCard({ icon: Icon, label, valor, total, color }) {
  const pct = total > 0 ? (valor / total) * 100 : 0
  const colores = {
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', bar: 'bg-emerald-500', icon: 'text-emerald-600' },
    brand: { bg: 'bg-brand-50', text: 'text-brand-700', bar: 'bg-brand-500', icon: 'text-brand-600' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', bar: 'bg-blue-500', icon: 'text-blue-600' },
  }[color]

  return (
    <div className={`${colores.bg} rounded-xl p-3`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className={colores.icon} />
        <span className="text-xs font-medium text-slate-700">{label}</span>
        <span className="ml-auto text-xs text-slate-500 tabular-nums">{pct.toFixed(0)}%</span>
      </div>
      <div className={`text-xl font-bold ${colores.text}`}>{formatColones(valor)}</div>
      <div className="bg-white/60 h-1.5 rounded-full mt-2 overflow-hidden">
        <div className={`${colores.bar} h-full rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function CierreModal({ open, onClose, resumen, onCerrar }) {
  const [totalReal, setTotalReal] = useState('')
  const [notas, setNotas] = useState('')
  const [cerrando, setCerrando] = useState(false)

  useEffect(() => {
    if (open) {
      setTotalReal('')
      setNotas('')
    }
  }, [open])

  const real = parseFloat(totalReal) || 0
  const diferencia = real - resumen.total_efectivo

  const cerrar = async () => {
    if (totalReal === '') return toast.error('Ingresá el total real')
    setCerrando(true)
    try {
      await cajaAPI.cerrar({ total_real: real, notas: notas.trim() || null })
      toast.success('Cierre registrado')
      onCerrar()
    } catch (err) { toast.error(err.message) }
    finally { setCerrando(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Cierre de caja">
      <div className="space-y-4">
        <div className="bg-slate-50 rounded-lg p-3 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Ventas registradas</span><span className="font-medium">{resumen.cantidad_ventas}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Efectivo esperado</span><span className="font-bold text-brand-700">{formatColones(resumen.total_efectivo)}</span></div>
          <div className="flex justify-between text-xs text-slate-500"><span>SINPE</span><span>{formatColones(resumen.total_sinpe)}</span></div>
          <div className="flex justify-between text-xs text-slate-500"><span>Tarjeta</span><span>{formatColones(resumen.total_tarjeta)}</span></div>
        </div>

        <div>
          <label className="text-xs text-slate-500 mb-1 block">Total efectivo contado en caja</label>
          <input
            type="number"
            value={totalReal}
            onChange={e => setTotalReal(e.target.value)}
            placeholder="0"
            className="input-base w-full text-2xl text-right font-medium py-3"
            autoFocus
          />
        </div>

        {totalReal !== '' && (
          <div className={`rounded-lg p-3 ${
            diferencia === 0 ? 'bg-emerald-50 text-emerald-800' :
            diferencia > 0 ? 'bg-blue-50 text-blue-800' :
            'bg-red-50 text-red-800'
          }`}>
            <div className="text-xs mb-1">Diferencia</div>
            <div className="text-xl font-bold flex items-center gap-2">
              {diferencia === 0 ? <><Check size={18} /> Cuadrado perfecto</> :
               diferencia > 0 ? `+${formatColones(diferencia)} (sobrante)` :
               `${formatColones(diferencia)} (faltante)`}
            </div>
          </div>
        )}

        <div>
          <label className="text-xs text-slate-500 mb-1 block">Notas (opcional)</label>
          <textarea
            value={notas}
            onChange={e => setNotas(e.target.value)}
            placeholder="Observaciones del día..."
            className="input-base w-full"
            rows={2}
          />
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={cerrar} disabled={cerrando || totalReal === ''} className="btn-primary disabled:opacity-50">
            {cerrando ? 'Guardando...' : 'Confirmar cierre'}
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
          <div>
            <div className="text-xs text-slate-500">Fecha</div>
            <div>{formatFechaHora(venta.fecha)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Método de pago</div>
            <div className="capitalize">{venta.metodo_pago}</div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-3">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Productos</div>
          <div className="space-y-1.5">
            {venta.detalles.map(d => (
              <div key={d.id} className="flex justify-between items-center text-sm py-1.5 border-b border-slate-100 last:border-0">
                <div>
                  <div className="font-medium flex items-center gap-1.5">
                    {d.producto.tipo_venta === 'peso' && <Scale size={11} className="text-brand-500" />}
                    {d.producto.nombre}
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatCantidad(d.cantidad, d.producto)} × {formatColones(d.precio_unit)}
                  </div>
                </div>
                <div className="font-medium">{formatColones(d.subtotal)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-200 pt-3 space-y-1">
          {venta.metodo_pago === 'efectivo' && venta.monto_recibido && (
            <>
              <div className="flex justify-between text-sm text-slate-500">
                <span>Recibido</span><span>{formatColones(venta.monto_recibido)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-500">
                <span>Vuelto</span><span>{formatColones(venta.vuelto || 0)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between items-baseline border-t border-slate-100 pt-2">
            <span className="text-sm text-slate-500">Total</span>
            <span className="text-2xl font-bold text-brand-700">{formatColones(venta.total)}</span>
          </div>
        </div>
      </div>
    </Modal>
  )
}
