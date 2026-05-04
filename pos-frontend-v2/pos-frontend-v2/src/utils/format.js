// Formatear como colones costarricenses
export const formatColones = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '₡0'
  const valor = Number(n)
  const signo = valor < 0 ? '-' : ''
  return signo + '₡' + Math.abs(valor).toLocaleString('es-CR', { maximumFractionDigits: 0 })
}

export const toDateInput = (date) => {
  const d = date ? new Date(date) : new Date()
  return d.toISOString().split('T')[0]
}

export const formatFecha = (fecha) => {
  if (!fecha) return '—'
  const d = new Date(fecha)
  return d.toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export const formatFechaHora = (fecha) => {
  if (!fecha) return '—'
  const d = new Date(fecha)
  return d.toLocaleString('es-CR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export const diasParaVencer = (fechaVenc) => {
  if (!fechaVenc) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const venc = new Date(fechaVenc)
  return Math.ceil((venc - hoy) / (1000 * 60 * 60 * 24))
}

export const estadoProducto = (producto) => {
  if (!producto.activo) return { tipo: 'inactivo', label: 'Inactivo', color: 'gray' }
  const dias = diasParaVencer(producto.fecha_vencimiento)
  if (dias !== null && dias <= 30) return { tipo: 'vence', label: 'Vence pronto', color: 'red' }
  if (producto.stock <= producto.stock_minimo) return { tipo: 'bajo', label: 'Stock bajo', color: 'amber' }
  return { tipo: 'ok', label: 'OK', color: 'green' }
}

// Formatear stock con unidad
export const formatStock = (producto) => {
  if (producto.tipo_venta === 'peso') {
    const stock = Number(producto.stock).toLocaleString('es-CR', { maximumFractionDigits: 2 })
    return `${stock} ${producto.unidad_medida}`
  }
  return `${Math.floor(producto.stock)}`
}

// Etiqueta del precio según tipo
export const labelPrecio = (producto) => {
  if (producto.tipo_venta === 'peso') {
    return `${formatColones(producto.precio_venta)}/${producto.unidad_medida}`
  }
  return formatColones(producto.precio_venta)
}

// Formatear cantidad respetando tipo
export const formatCantidad = (cantidad, producto) => {
  if (producto?.tipo_venta === 'peso') {
    return `${Number(cantidad).toLocaleString('es-CR', { maximumFractionDigits: 3 })} ${producto.unidad_medida}`
  }
  return `${Math.floor(cantidad)}`
}
