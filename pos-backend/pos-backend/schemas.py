"""
Schemas Pydantic para validación de entrada/salida.
"""
from datetime import datetime, date
from typing import Optional, List, Literal
from pydantic import BaseModel, Field


# ---------- AUTH ----------
class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: "UsuarioOut"


class UsuarioOut(BaseModel):
    id: int
    username: str
    nombre_completo: Optional[str]
    is_admin: bool

    class Config:
        from_attributes = True


class CambiarPasswordRequest(BaseModel):
    password_actual: str
    password_nueva: str = Field(min_length=6)


# ---------- CATEGORIAS ----------
class CategoriaBase(BaseModel):
    nombre: str


class CategoriaCreate(CategoriaBase):
    pass


class CategoriaOut(CategoriaBase):
    id: int

    class Config:
        from_attributes = True


# ---------- PRODUCTOS ----------
TipoVenta = Literal["unidad", "peso"]
UnidadMedida = Literal["kg", "g"]


class ProductoBase(BaseModel):
    codigo: Optional[str] = None
    nombre: str
    tipo_venta: TipoVenta = "unidad"
    unidad_medida: Optional[UnidadMedida] = None
    precio_venta: float = Field(gt=0)
    costo: float = Field(ge=0, default=0)
    stock: float = Field(ge=0, default=0)
    stock_minimo: float = Field(ge=0, default=5)
    categoria_id: Optional[int] = None
    fecha_vencimiento: Optional[date] = None
    activo: bool = True


class ProductoCreate(ProductoBase):
    pass


class ProductoUpdate(BaseModel):
    codigo: Optional[str] = None
    nombre: Optional[str] = None
    tipo_venta: Optional[TipoVenta] = None
    unidad_medida: Optional[UnidadMedida] = None
    precio_venta: Optional[float] = None
    costo: Optional[float] = None
    stock: Optional[float] = None
    stock_minimo: Optional[float] = None
    categoria_id: Optional[int] = None
    fecha_vencimiento: Optional[date] = None
    activo: Optional[bool] = None


class ProductoOut(ProductoBase):
    id: int
    categoria: Optional[CategoriaOut] = None

    class Config:
        from_attributes = True


# ---------- VENTAS ----------
class DetalleVentaCreate(BaseModel):
    producto_id: int
    cantidad: float = Field(gt=0)


class VentaCreate(BaseModel):
    detalles: List[DetalleVentaCreate]
    metodo_pago: str
    monto_recibido: Optional[float] = None


class DetalleVentaOut(BaseModel):
    id: int
    producto_id: int
    cantidad: float
    precio_unit: float
    costo_unit: float
    subtotal: float
    producto: ProductoOut

    class Config:
        from_attributes = True


class VentaOut(BaseModel):
    id: int
    fecha: datetime
    subtotal: float
    total: float
    metodo_pago: str
    monto_recibido: Optional[float]
    vuelto: Optional[float]
    detalles: List[DetalleVentaOut] = []

    class Config:
        from_attributes = True


# ---------- COMPRAS ----------
class DetalleCompraCreate(BaseModel):
    producto_id: int
    cantidad: float = Field(gt=0)
    costo_unit: float = Field(ge=0)


class CompraCreate(BaseModel):
    proveedor: Optional[str] = None
    detalles: List[DetalleCompraCreate]


class DetalleCompraOut(BaseModel):
    id: int
    producto_id: int
    cantidad: float
    costo_unit: float
    producto: ProductoOut

    class Config:
        from_attributes = True


class CompraOut(BaseModel):
    id: int
    fecha: datetime
    proveedor: Optional[str]
    total: float
    detalles: List[DetalleCompraOut] = []

    class Config:
        from_attributes = True


# ---------- CAJA ----------
class CierreCajaCreate(BaseModel):
    total_real: float
    notas: Optional[str] = None


class CierreCajaOut(BaseModel):
    id: int
    fecha_cierre: datetime
    total_esperado: float
    total_real: float
    diferencia: float
    total_efectivo: float
    total_sinpe: float
    total_tarjeta: float
    cantidad_ventas: int
    notas: Optional[str]

    class Config:
        from_attributes = True


class ResumenCaja(BaseModel):
    total_dia: float
    cantidad_ventas: int
    total_efectivo: float
    total_sinpe: float
    total_tarjeta: float


# ---------- REPORTES ----------
class ProductoMasVendido(BaseModel):
    producto_id: int
    nombre: str
    cantidad_total: float
    monto_total: float


class ReporteVentas(BaseModel):
    fecha_inicio: date
    fecha_fin: date
    total_ventas: float
    cantidad_ventas: int
    ganancia_bruta: float
    productos_top: List[ProductoMasVendido]


class VentaPorDia(BaseModel):
    fecha: date
    total: float
    cantidad: int
    ganancia: float


class GananciaPorDia(BaseModel):
    fecha: date
    ventas: float
    ganancia_bruta: float
    compras: float
    flujo_neto: float  # ganancia_bruta - compras


class GananciaPorMes(BaseModel):
    año: int
    mes: int
    ventas: float
    ganancia_bruta: float
    compras: float
    flujo_neto: float


class GananciaResumen(BaseModel):
    fecha_inicio: date
    fecha_fin: date
    total_ventas: float
    ganancia_bruta: float
    total_compras: float
    flujo_neto: float
    cantidad_ventas: int
    cantidad_compras: int


# ---------- CONFIGURACION ----------
class ConfiguracionItem(BaseModel):
    clave: str
    valor: str


class ConfiguracionOut(BaseModel):
    id: int
    clave: str
    valor: str

    class Config:
        from_attributes = True


# Resolución circular
TokenResponse.model_rebuild()
