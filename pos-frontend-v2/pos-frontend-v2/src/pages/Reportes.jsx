import { useEffect, useState } from 'react'
import { Download, TrendingUp, TrendingDown, Calendar, DollarSign, ShoppingBag, ArrowDownCircle, Info } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, Legend } from 'recharts'
import toast from 'react-hot-toast'
import { reportesAPI } from '../services/api'
import { formatColones, toDateInput } from '../utils/format'

const presets = [
  { key: 'hoy', label: 'Hoy' },
  { key: 'semana', label: 'Esta semana' },
  { key: 'mes', label: 'Últimos 30 días' },
]

const calcularRango = (preset) => {
  const hoy = new Date()
  const fin = toDateInput(hoy)
  let inicio = new Date(hoy)
  if (preset === 'hoy') inicio = hoy
  else if (preset === 'semana') inicio.setDate(hoy.getDate() - 6)
  else if (preset === 'mes') inicio.setDate(hoy.getDate() - 29)
  return { fecha_inicio: toDateInput(inicio), fecha_fin: fin }
}

const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export default function Reportes() {
  const [tab, setTab] = useState('ventas') // 'ventas' o 'ganancias'
  const [preset, setPreset] = useState('mes')
  const [fechaInicio, setFechaInicio] = useState(calcularRango('mes').fecha_inicio)
  const [fechaFin, setFechaFin] = useState(calcularRango('mes').fecha_fin)

  const [reporte, setReporte] = useState(null)
  const [porDia, setPorDia] = useState([])
  const [gananciaResumen, setGananciaResumen] = useState(null)
  const [gananciaPorDia, setGananciaPorDia] = useState([])
  const [gananciaMensual, setGananciaMensual] = useState([])
  const [añoMensual, setAñoMensual] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)

  const cargar = async () => {
    setLoading(true)
    try {
      if (tab === 'ventas') {
        const [r, p] = await Promise.all([
          reportesAPI.porRango(fechaInicio, fechaFin, 5),
          reportesAPI.porDia(fechaInicio, fechaFin),
        ])
        setReporte(r)
        setPorDia(p.map(d => ({
          ...d,
          diaCorto: new Date(d.fecha + 'T00:00:00').toLocaleDateString('es-CR', { day: '2-digit', month: 'short' }),
        })))
      } else {
        const [resumen, porDia, mensual] = await Promise.all([
          reportesAPI.gananciaResumen(fechaInicio, fechaFin),
          reportesAPI.gananciaPorDia(fechaInicio, fechaFin),
          reportesAPI.gananciaMensual(añoMensual),
        ])
        setGananciaResumen(resumen)
        setGananciaPorDia(porDia.map(d => ({
          ...d,
          diaCorto: new Date(d.fecha + 'T00:00:00').toLocaleDateString('es-CR', { day: '2-digit', month: 'short' }),
        })))
        setGananciaMensual(mensual.map(m => ({ ...m, mesNombre: meses[m.mes - 1] })))
      }
    } catch (err) {
      toast.error('Error al cargar reportes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [tab, fechaInicio, fechaFin, añoMensual]) // eslint-disable-line

  const aplicarPreset = (p) => {
    setPreset(p)
    const { fecha_inicio, fecha_fin } = calcularRango(p)
    setFechaInicio(fecha_inicio)
    setFechaFin(fecha_fin)
  }

  const exportar = () => {
    if (tab === 'ventas' && reporte) {
      const csv = [
        ['Reporte de ventas'],
        ['Periodo', `${fechaInicio} a ${fechaFin}`],
        [''],
        ['Total ventas', reporte.total_ventas],
        ['Cantidad ventas', reporte.cantidad_ventas],
        ['Ganancia bruta', reporte.ganancia_bruta],
        [''],
        ['Productos más vendidos'],
        ['Producto', 'Unidades', 'Monto'],
        ...reporte.productos_top.map(p => [p.nombre, p.cantidad_total, p.monto_total]),
      ].map(r => r.join(',')).join('\n')
      descargar(csv, `reporte-ventas-${fechaInicio}-${fechaFin}.csv`)
    } else if (tab === 'ganancias' && gananciaResumen) {
      const csv = [
        ['Reporte de ganancias'],
        ['Periodo', `${fechaInicio} a ${fechaFin}`],
        [''],
        ['Total ventas', gananciaResumen.total_ventas],
        ['Ganancia bruta', gananciaResumen.ganancia_bruta],
        ['Total compras', gananciaResumen.total_compras],
        ['Flujo neto', gananciaResumen.flujo_neto],
        [''],
        ['Detalle por día'],
        ['Fecha', 'Ventas', 'Ganancia bruta', 'Compras', 'Flujo neto'],
        ...gananciaPorDia.map(d => [d.fecha, d.ventas, d.ganancia_bruta, d.compras, d.flujo_neto]),
      ].map(r => r.join(',')).join('\n')
      descargar(csv, `reporte-ganancias-${fechaInicio}-${fechaFin}.csv`)
    }
    toast.success('Reporte exportado')
  }

  const descargar = (csv, nombre) => {
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nombre
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab('ventas')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'ventas' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >Ventas</button>
        <button
          onClick={() => setTab('ganancias')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'ganancias' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >Ganancias</button>
      </div>

      {/* Filtros de rango */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="date"
          value={fechaInicio}
          onChange={e => { setFechaInicio(e.target.value); setPreset(null) }}
          className="input-base"
        />
        <span className="text-slate-500 text-sm">a</span>
        <input
          type="date"
          value={fechaFin}
          onChange={e => { setFechaFin(e.target.value); setPreset(null) }}
          className="input-base"
        />
        {presets.map(p => (
          <button
            key={p.key}
            onClick={() => aplicarPreset(p.key)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              preset === p.key
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >{p.label}</button>
        ))}
        <button onClick={exportar} className="btn-secondary ml-auto flex items-center gap-2">
          <Download size={14} /> Exportar CSV
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Cargando...</div>
      ) : tab === 'ventas' && reporte ? (
        <ContenidoVentas reporte={reporte} porDia={porDia} />
      ) : tab === 'ganancias' && gananciaResumen ? (
        <ContenidoGanancias
          resumen={gananciaResumen}
          porDia={gananciaPorDia}
          mensual={gananciaMensual}
          añoMensual={añoMensual}
          setAñoMensual={setAñoMensual}
        />
      ) : null}
    </div>
  )
}

// ---------- TAB VENTAS ----------
function ContenidoVentas({ reporte, porDia }) {
  const margenPromedio = reporte.total_ventas > 0
    ? (reporte.ganancia_bruta / reporte.total_ventas) * 100
    : 0

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KPICard label="VENTAS TOTALES" valor={formatColones(reporte.total_ventas)} icon={DollarSign} />
        <KPICard label="CANTIDAD VENTAS" valor={reporte.cantidad_ventas} subtitulo={`${(reporte.cantidad_ventas / Math.max(1, porDia.length)).toFixed(1)} promedio/día`} icon={ShoppingBag} />
        <KPICard label="GANANCIA BRUTA" valor={formatColones(reporte.ganancia_bruta)} subtitulo={`${margenPromedio.toFixed(0)}% margen`} icon={TrendingUp} resaltado="green" />
      </div>

      <div className="card">
        <div className="font-medium mb-3">Ventas por día</div>
        {porDia.length === 0 ? (
          <div className="py-8 text-center text-slate-400">Sin datos</div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porDia} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="diaCorto" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                <Tooltip
                  formatter={(v) => formatColones(v)}
                  labelFormatter={(l) => `Día ${l}`}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
                />
                <Bar dataKey="total" fill="#7F77DD" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={16} className="text-brand-600" />
          <div className="font-medium">Productos más vendidos</div>
        </div>
        {reporte.productos_top.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">Sin datos en este período</div>
        ) : (
          <div className="space-y-3">
            {reporte.productos_top.map((p, idx) => {
              const maxCantidad = reporte.productos_top[0].cantidad_total
              const pct = (p.cantidad_total / maxCantidad) * 100
              const colors = ['bg-brand-600', 'bg-brand-400', 'bg-brand-200', 'bg-brand-100', 'bg-brand-50']
              const textColors = ['text-white', 'text-white', 'text-brand-800', 'text-brand-800', 'text-brand-800']
              return (
                <div key={p.producto_id} className="grid grid-cols-[28px_1fr_90px_100px] gap-3 items-center">
                  <div className={`${colors[idx]} ${textColors[idx]} w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold`}>
                    {idx + 1}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{p.nombre}</div>
                    <div className="bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                      <div className={`${colors[idx]} h-full rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="text-sm text-right text-slate-600">{Number(p.cantidad_total).toLocaleString('es-CR', { maximumFractionDigits: 2 })}</div>
                  <div className="text-sm font-medium text-right">{formatColones(p.monto_total)}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

// ---------- TAB GANANCIAS ----------
function ContenidoGanancias({ resumen, porDia, mensual, añoMensual, setAñoMensual }) {
  const flujoEsPositivo = resumen.flujo_neto >= 0

  return (
    <>
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="VENTAS" valor={formatColones(resumen.total_ventas)} subtitulo={`${resumen.cantidad_ventas} ventas`} icon={DollarSign} />
        <KPICard label="GANANCIA BRUTA" valor={formatColones(resumen.ganancia_bruta)} subtitulo="precio - costo × qty" icon={TrendingUp} resaltado="green" />
        <KPICard label="COMPRAS" valor={formatColones(resumen.total_compras)} subtitulo={`${resumen.cantidad_compras} compras`} icon={ShoppingBag} resaltado="amber" />
        <KPICard
          label="FLUJO NETO"
          valor={formatColones(resumen.flujo_neto)}
          subtitulo="ganancia - compras"
          icon={flujoEsPositivo ? TrendingUp : TrendingDown}
          resaltado={flujoEsPositivo ? "green" : "red"}
        />
      </div>

      {/* Aclaración */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex gap-3 text-sm">
        <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
        <div className="text-blue-900">
          <div className="font-medium mb-1">¿Cómo interpretar estos números?</div>
          <div className="text-xs leading-relaxed">
            <strong>Ganancia bruta</strong> = lo que ganaste por las ventas (precio menos costo del producto).<br />
            <strong>Flujo neto</strong> = ganancia bruta menos las compras a proveedores en el periodo. Es una métrica de flujo de caja, no de utilidad real.
            Si comprás mucho stock que aún no vendiste, el flujo puede ser negativo aunque tu negocio esté sano.
          </div>
        </div>
      </div>

      {/* Gráfico ganancia por día */}
      <div className="card">
        <div className="font-medium mb-3">Ganancia y compras por día</div>
        {porDia.length === 0 ? (
          <div className="py-8 text-center text-slate-400">Sin datos</div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porDia} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="diaCorto" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
                <Tooltip
                  formatter={(v, name) => [formatColones(v), name]}
                  labelFormatter={(l) => `Día ${l}`}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="ganancia_bruta" name="Ganancia bruta" fill="#1D9E75" radius={[4, 4, 0, 0]} />
                <Bar dataKey="compras" name="Compras" fill="#EF9F27" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Vista mensual */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-brand-600" />
            <div className="font-medium">Ganancia mensual {añoMensual}</div>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setAñoMensual(añoMensual - 1)}
              className="px-2 py-1 text-xs rounded-md bg-slate-100 hover:bg-slate-200"
            >← {añoMensual - 1}</button>
            <button
              onClick={() => setAñoMensual(new Date().getFullYear())}
              className="px-2 py-1 text-xs rounded-md bg-slate-100 hover:bg-slate-200"
            >Hoy</button>
            <button
              onClick={() => setAñoMensual(añoMensual + 1)}
              disabled={añoMensual >= new Date().getFullYear()}
              className="px-2 py-1 text-xs rounded-md bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >{añoMensual + 1} →</button>
          </div>
        </div>

        <div className="h-72 mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mensual} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="mesNombre" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v} />
              <Tooltip
                formatter={(v, name) => [formatColones(v), name]}
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="ganancia_bruta" name="Ganancia bruta" stroke="#1D9E75" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="compras" name="Compras" stroke="#EF9F27" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="flujo_neto" name="Flujo neto" stroke="#534AB7" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Tabla resumen mensual */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="text-left py-2 px-2 font-medium">Mes</th>
                <th className="text-right py-2 px-2 font-medium">Ventas</th>
                <th className="text-right py-2 px-2 font-medium">Ganancia</th>
                <th className="text-right py-2 px-2 font-medium">Compras</th>
                <th className="text-right py-2 px-2 font-medium">Flujo neto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mensual.map(m => {
                const sinDatos = m.ventas === 0 && m.compras === 0
                return (
                  <tr key={m.mes} className={sinDatos ? 'opacity-40' : ''}>
                    <td className="py-2 px-2 font-medium">{m.mesNombre}</td>
                    <td className="py-2 px-2 text-right">{formatColones(m.ventas)}</td>
                    <td className="py-2 px-2 text-right text-emerald-700">{formatColones(m.ganancia_bruta)}</td>
                    <td className="py-2 px-2 text-right text-amber-700">{formatColones(m.compras)}</td>
                    <td className={`py-2 px-2 text-right font-medium ${m.flujo_neto >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {formatColones(m.flujo_neto)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function KPICard({ label, valor, subtitulo, icon: Icon, resaltado }) {
  const colores = {
    green: 'text-emerald-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
  }
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-slate-500">{label}</div>
        {Icon && <Icon size={14} className={resaltado ? colores[resaltado] : 'text-slate-400'} />}
      </div>
      <div className={`text-2xl font-bold mt-1 ${resaltado ? colores[resaltado] : 'text-slate-800'}`}>{valor}</div>
      {subtitulo && <div className="text-xs text-slate-400 mt-0.5">{subtitulo}</div>}
    </div>
  )
}
