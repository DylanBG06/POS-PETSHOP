import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
})

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('pos_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      sessionStorage.removeItem('pos_token')
      sessionStorage.removeItem('pos_usuario')
      if (window.location.pathname !== '/login') window.location.href = '/login'
    }
    const detail = err.response?.data?.detail || err.message || 'Error desconocido'
    return Promise.reject({ message: detail, status: err.response?.status })
  }
)

export const authAPI = {
  login: (username, password) => api.post('/auth/login', { username, password }).then(r => r.data),
  yo: () => api.get('/auth/yo').then(r => r.data),
  cambiarPassword: (password_actual, password_nueva) =>
    api.post('/auth/cambiar-password', { password_actual, password_nueva }).then(r => r.data),
}

export const productosAPI = {
  listar: (params = {}) => api.get('/productos/', { params }).then(r => r.data),
  buscarRapido: (q) => api.get('/productos/buscar-rapido', { params: { q } }).then(r => r.data),
  obtener: (id) => api.get(`/productos/${id}`).then(r => r.data),
  crear: (data) => api.post('/productos/', data).then(r => r.data),
  actualizar: (id, data) => api.put(`/productos/${id}`, data).then(r => r.data),
  eliminar: (id) => api.delete(`/productos/${id}`),
  desglosar: (id, body) => api.post(`/productos/${id}/desglosar`, body).then(r => r.data),
  vincularPadre: (id, id_padre, factor_conversion) => api.post(`/productos/${id}/vincular-padre`, { id_padre, factor_conversion }).then(r => r.data),
  huerfanos: () => api.get('/productos/utils/huerfanos').then(r => r.data),
  hijos: (id) => api.get(`/productos/${id}/hijos`).then(r => r.data),
  stockBajo: () => api.get('/productos/alertas/stock-bajo').then(r => r.data),
  porVencer: (dias = 30) => api.get('/productos/alertas/por-vencer', { params: { dias } }).then(r => r.data),
}

export const categoriasAPI = {
  listar: () => api.get('/categorias/').then(r => r.data),
  crear: (data) => api.post('/categorias/', data).then(r => r.data),
  actualizar: (id, data) => api.put(`/categorias/${id}`, data).then(r => r.data),
  eliminar: (id) => api.delete(`/categorias/${id}`),
}

export const ingresosAPI = {
  listar: (params = {}) => api.get('/ingresos/', { params }).then(r => r.data),
  crear: (data) => api.post('/ingresos/', data).then(r => r.data),
  eliminar: (id) => api.delete(`/ingresos/${id}`),
}

export const ventasAPI = {
  listar: (params = {}) => api.get('/ventas/', { params }).then(r => r.data),
  listarDesde: (desde) => api.get('/ventas/', { params: { fecha_inicio: desde.split('T')[0], limit: 200 } }).then(r => r.data),
  obtener: (id) => api.get(`/ventas/${id}`).then(r => r.data),
  crear: (data) => api.post('/ventas/', data).then(r => r.data),
}

export const comprasAPI = {
  listar: (params = {}) => api.get('/compras/', { params }).then(r => r.data),
  obtener: (id) => api.get(`/compras/${id}`).then(r => r.data),
  crear: (data) => api.post('/compras/', data).then(r => r.data),
  eliminar: (id) => api.delete(`/compras/${id}`),
}

export const cajaAPI = {
  resumenHoy: () => api.get('/caja/resumen-hoy').then(r => r.data),
  aperturaHoy: () => api.get('/caja/apertura-hoy').then(r => r.data),
  registrarApertura: (data) => api.post('/caja/apertura', data).then(r => r.data),
  cerrar: (data) => api.post('/caja/cerrar', data).then(r => r.data),
  cierres: (limit = 30) => api.get('/caja/cierres', { params: { limit } }).then(r => r.data),
  ventasDeCierre: (cierreId) => api.get(`/caja/cierres/${cierreId}/ventas`).then(r => r.data),
  eliminarCierre: (id) => api.delete(`/caja/cierres/${id}`),
}

export const reportesAPI = {
  porRango: (fecha_inicio, fecha_fin, top_productos = 10) =>
    api.get('/reportes/rango', { params: { fecha_inicio, fecha_fin, top_productos } }).then(r => r.data),
  porDia: (fecha_inicio, fecha_fin) =>
    api.get('/reportes/por-dia', { params: { fecha_inicio, fecha_fin } }).then(r => r.data),
  productosTop: (dias = 30, limit = 10) =>
    api.get('/reportes/productos-top', { params: { dias, limit } }).then(r => r.data),
  gananciaResumen: (fecha_inicio, fecha_fin) =>
    api.get('/reportes/ganancia-resumen', { params: { fecha_inicio, fecha_fin } }).then(r => r.data),
  gananciaPorDia: (fecha_inicio, fecha_fin) =>
    api.get('/reportes/ganancia-por-dia', { params: { fecha_inicio, fecha_fin } }).then(r => r.data),
  gananciaMensual: (año) =>
    api.get('/reportes/ganancia-mensual', { params: { año } }).then(r => r.data),
}

export const configAPI = {
  listar: () => api.get('/configuracion/').then(r => r.data),
  obtener: (clave) => api.get(`/configuracion/${clave}`).then(r => r.data),
  actualizar: (clave, valor) => api.put('/configuracion/', { clave, valor }).then(r => r.data),
}

export default api
