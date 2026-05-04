import { useEffect, useState } from 'react'
import { Plus, Trash2, Truck, Package, X, Scale } from 'lucide-react'
import toast from 'react-hot-toast'
import { comprasAPI, productosAPI } from '../services/api'
import { formatColones, formatFechaHora, formatStock, formatCantidad } from '../utils/format'
import Modal from '../components/Modal'

export default function Compras() {
  const [compras, setCompras] = useState([])
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [detalleCompra, setDetalleCompra] = useState(null)

  const cargar = async () => {
    setLoading(true)
    try {
      const [c, p] = await Promise.all([
        comprasAPI.listar({ limit: 50 }),
        productosAPI.listar({ solo_activos: true }),
      ])
      setCompras(c)
      setProductos(p)
    } catch (err) {
      toast.error('Error al cargar compras')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard
          label="COMPRAS REGISTRADAS"
          valor={compras.length}
          icon={Truck}
        />
        <StatCard
          label="GASTO ÚLTIMO MES"
          valor={formatColones(compras
            .filter(c => new Date(c.fecha) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
            .reduce((s, c) => s + c.total, 0)
          )}
          icon={Package}
        />
        <StatCard
          label="GASTO HOY"
          valor={formatColones(compras
            .filter(c => new Date(c.fecha).toDateString() === new Date().toDateString())
            .reduce((s, c) => s + c.total, 0)
          )}
          icon={Package}
          resaltado
        />
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-slate-800">Compras a proveedores</h2>
        <button onClick={() => setModalAbierto(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Nueva compra
        </button>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="text-left py-3 px-3 font-medium">Fecha</th>
                <th className="text-left py-3 px-3 font-medium">Proveedor</th>
                <th className="text-right py-3 px-3 font-medium">Productos</th>
                <th className="text-right py-3 px-3 font-medium">Total</th>
                <th className="py-3 px-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="py-12 text-center text-slate-400">Cargando...</td></tr>
              ) : compras.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-slate-400">
                  Sin compras registradas. Hacé clic en "Nueva compra" para registrar la primera.
                </td></tr>
              ) : compras.map(c => (
                <tr key={c.id} className="hover:bg-slate-50/80">
                  <td className="py-2.5 px-3 text-xs text-slate-600">{formatFechaHora(c.fecha)}</td>
                  <td className="py-2.5 px-3 font-medium">{c.proveedor || '—'}</td>
                  <td className="py-2.5 px-3 text-right text-xs">{c.detalles.length} ítem{c.detalles.length !== 1 ? 's' : ''}</td>
                  <td className="py-2.5 px-3 text-right font-medium">{formatColones(c.total)}</td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => setDetalleCompra(c)}
                      className="text-xs text-brand-600 hover:underline"
                    >Ver detalle</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <CompraModal
        open={modalAbierto}
        onClose={() => setModalAbierto(false)}
        productos={productos}
        onGuardar={() => { setModalAbierto(false); cargar() }}
      />

      <DetalleModal
        compra={detalleCompra}
        onClose={() => setDetalleCompra(null)}
      />
    </div>
  )
}

function StatCard({ label, valor, icon: Icon, resaltado }) {
  return (
    <div className={`card ${resaltado ? 'border-brand-200 bg-brand-50/30' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-slate-500">{label}</div>
        {Icon && <Icon size={14} className={resaltado ? 'text-brand-600' : 'text-slate-400'} />}
      </div>
      <div className={`text-2xl font-bold mt-1 ${resaltado ? 'text-brand-700' : 'text-slate-800'}`}>{valor}</div>
    </div>
  )
}

function CompraModal({ open, onClose, productos, onGuardar }) {
  const [proveedor, setProveedor] = useState('')
  const [items, setItems] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (open) {
      setProveedor('')
      setItems([])
      setBusqueda('')
    }
  }, [open])

  const productosFiltrados = busqueda.trim()
    ? productos.filter(p =>
        p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.codigo?.toLowerCase().includes(busqueda.toLowerCase())
      ).slice(0, 8)
    : []

  const agregarProducto = (producto) => {
    if (items.find(i => i.producto_id === producto.id)) {
      toast.error('Ya está en la lista')
      return
    }
    setItems([...items, {
      producto_id: producto.id,
      nombre: producto.nombre,
      tipo_venta: producto.tipo_venta,
      unidad_medida: producto.unidad_medida,
      cantidad: producto.tipo_venta === 'peso' ? 1.0 : 1,
      costo_unit: producto.costo || 0,
    }])
    setBusqueda('')
  }

  const actualizarItem = (idx, campo, valor) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [campo]: valor } : it))
  }

  const quitarItem = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  const total = items.reduce((s, it) => {
    const cant = parseFloat(it.cantidad) || 0
    const costo = parseFloat(it.costo_unit) || 0
    return s + (cant * costo)
  }, 0)

  const guardar = async () => {
    if (items.length === 0) return toast.error('Agregá al menos un producto')
    if (items.some(it => !it.cantidad || parseFloat(it.cantidad) <= 0)) {
      return toast.error('Todas las cantidades deben ser mayores a 0')
    }
    if (items.some(it => parseFloat(it.costo_unit) < 0)) {
      return toast.error('El costo no puede ser negativo')
    }
    // Validar que los productos por unidad tengan cantidad entera
    const itemDecimal = items.find(it =>
      it.tipo_venta === 'unidad' && parseFloat(it.cantidad) !== Math.floor(parseFloat(it.cantidad))
    )
    if (itemDecimal) {
      return toast.error(`"${itemDecimal.nombre}" se vende por unidades, la cantidad debe ser entera`)
    }

    setGuardando(true)
    try {
      await comprasAPI.crear({
        proveedor: proveedor.trim() || null,
        detalles: items.map(it => ({
          producto_id: it.producto_id,
          cantidad: parseFloat(it.cantidad),
          costo_unit: parseFloat(it.costo_unit),
        })),
      })
      toast.success('Compra registrada y stock actualizado')
      onGuardar()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Registrar compra a proveedor" maxWidth="max-w-3xl">
      <div className="space-y-4">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Proveedor (opcional)</label>
          <input
            type="text"
            value={proveedor}
            onChange={e => setProveedor(e.target.value)}
            placeholder="Ej: Distribuidora Mascotas SA"
            className="input-base w-full"
          />
        </div>

        <div>
          <label className="text-xs text-slate-500 mb-1 block">Agregar productos</label>
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar producto por nombre o código..."
            className="input-base w-full"
          />

          {productosFiltrados.length > 0 && (
            <div className="mt-2 border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
              {productosFiltrados.map(p => (
                <button
                  key={p.id}
                  onClick={() => agregarProducto(p)}
                  className="w-full flex items-center justify-between p-2.5 hover:bg-slate-50 text-left text-sm border-b border-slate-100 last:border-0"
                >
                  <div className="flex items-center gap-1.5">
                    {p.tipo_venta === 'peso' && <Scale size={12} className="text-brand-500" />}
                    <div>
                      <div className="font-medium">{p.nombre}</div>
                      <div className="text-xs text-slate-500">{p.codigo || 'Sin código'} · Stock: {formatStock(p)}</div>
                    </div>
                  </div>
                  <Plus size={14} className="text-slate-400" />
                </button>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Items</div>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_110px_110px_100px_30px] gap-2 items-center bg-slate-50 p-2 rounded-lg">
                  <div className="text-sm font-medium flex items-center gap-1.5 min-w-0">
                    {it.tipo_venta === 'peso' && <Scale size={12} className="text-brand-500 shrink-0" />}
                    <span className="truncate">{it.nombre}</span>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-0.5">
                      Cantidad{it.tipo_venta === 'peso' ? ` (${it.unidad_medida})` : ''}
                    </label>
                    <input
                      type="number"
                      step={it.tipo_venta === 'peso' ? '0.001' : '1'}
                      min="0"
                      value={it.cantidad}
                      onChange={e => actualizarItem(idx, 'cantidad', e.target.value)}
                      className="input-base w-full text-sm py-1.5"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-0.5">
                      Costo {it.tipo_venta === 'peso' ? `por ${it.unidad_medida}` : 'unit.'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={it.costo_unit}
                      onChange={e => actualizarItem(idx, 'costo_unit', e.target.value)}
                      className="input-base w-full text-sm py-1.5"
                    />
                  </div>

                  <div className="text-right text-sm font-medium pt-4">
                    {formatColones((parseFloat(it.cantidad) || 0) * (parseFloat(it.costo_unit) || 0))}
                  </div>

                  <button onClick={() => quitarItem(idx)} className="text-red-500 hover:text-red-700 mt-4">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-slate-200 pt-3 flex justify-between items-center">
          <div className="text-xs text-slate-500">
            {items.length} producto{items.length !== 1 ? 's' : ''}
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">TOTAL</div>
            <div className="text-2xl font-bold text-brand-700">{formatColones(total)}</div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
          ⚠️ Al registrar la compra: el <strong>stock se incrementará</strong> automáticamente
          y el <strong>costo de cada producto se actualizará</strong> al nuevo costo.
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={guardar} disabled={guardando || items.length === 0} className="btn-primary disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Registrar compra'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function DetalleModal({ compra, onClose }) {
  if (!compra) return null
  return (
    <Modal open={!!compra} onClose={onClose} title={`Compra #${compra.id}`}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-slate-500">Fecha</div>
            <div>{formatFechaHora(compra.fecha)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Proveedor</div>
            <div>{compra.proveedor || '—'}</div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-3">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Items</div>
          <div className="space-y-1.5">
            {compra.detalles.map(d => (
              <div key={d.id} className="flex justify-between items-center text-sm py-2 border-b border-slate-100 last:border-0">
                <div>
                  <div className="font-medium flex items-center gap-1.5">
                    {d.producto.tipo_venta === 'peso' && <Scale size={11} className="text-brand-500" />}
                    {d.producto.nombre}
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatCantidad(d.cantidad, d.producto)} × {formatColones(d.costo_unit)}
                  </div>
                </div>
                <div className="font-medium">{formatColones(d.cantidad * d.costo_unit)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-200 pt-3 flex justify-between items-baseline">
          <div className="text-sm text-slate-500">Total</div>
          <div className="text-2xl font-bold text-brand-700">{formatColones(compra.total)}</div>
        </div>
      </div>
    </Modal>
  )
}
