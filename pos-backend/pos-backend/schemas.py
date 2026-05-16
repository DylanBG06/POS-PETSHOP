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
TipoProducto = Literal["COMPRABLE", "DERIVADO"]


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
    tipo_producto: TipoProducto = "COMPRABLE"
    id_padre: Optional[int] = None
    factor_conversion: Optional[float] = None


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
    tipo_producto: Optional[TipoProducto] = None
    id_padre: Optional[int] = None
    factor_conversion: Optional[float] = None


class ProductoOut(ProductoBase):
    id: int
    categoria: Optional[CategoriaOut] = None
    nombre_padre: Optional[str] = None

    class Config:
        from_attributes = True


class DesgloseItem(BaseModel):
    """Un item del desglose multiformato: cuántas unidades del padre convertir en este hijo."""
    hijo_id: int = Field(gt=0)
    cantidad_padres: float = Field(gt=0, description="Unidades equivalentes del padre destinadas a este hijo (puede ser fraccional)")


class DesglosarRequest(BaseModel):
    """
    Desglose simple (un solo hijo): cantidad_padres + hijo_id.
    Desglose multi-formato: lista de items.
    """
    cantidad_padres: Optional[float] = Field(default=None, gt=0)
    hijo_id: Optional[int] = Field(default=None, gt=0)
    items: Optional[List[DesgloseItem]] = None


class VincularPadreRequest(BaseModel):
    """Vincular un producto huérfano como hijo de otro."""
    id_padre: int = Field(gt=0)
    factor_conversion: float = Field(gt=0)


# ---------- VENTAS ----------
class DetalleVentaCreate(BaseModel):
    producto_id: int
    cantidad: float = Field(gt=0)
    es_regalia: bool = False
    descuento_monto: float = Field(ge=0, default=0)      # Descuento en ₡ sobre este item
    descuento_porcentaje: float = Field(ge=0, le=100, default=0)  # Descuento en % sobre este item


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
    descuento_item: float = 0
    subtotal: float
    es_regalia: bool = False
    producto: ProductoOut

    class Config:
        from_attributes = True


class VentaOut(BaseModel):
    id: int
    fecha: datetime
    subtotal: float
    descuento: float = 0
    monto_regalias: float = 0
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
    es_regalia: bool = False  # Si es True, costo es 0 y no afecta el promedio


class CompraCreate(BaseModel):
    proveedor: Optional[str] = None
    detalles: List[DetalleCompraCreate]
    descuento_monto: float = Field(ge=0, default=0)
    iva_monto: float = Field(ge=0, default=0)        # IVA en colones
    iva_porcentaje: float = Field(ge=0, le=100, default=0)  # IVA en %


class DetalleCompraOut(BaseModel):
    id: int
    producto_id: int
    cantidad: float
    costo_unit: float
    es_regalia: bool = False
    producto: ProductoOut

    class Config:
        from_attributes = True


class CompraOut(BaseModel):
    id: int
    fecha: datetime
    proveedor: Optional[str]
    descuento: float = 0
    iva: float = 0
    total: float
    detalles: List[DetalleCompraOut] = []

    class Config:
        from_attributes = True


# ---------- INGRESOS ----------
class IngresoCreate(BaseModel):
    producto_id: int
    descripcion: Optional[str] = None
    cantidad: float = Field(gt=0)
    costo_unit: float = Field(ge=0)
    venta_unit: float = Field(ge=0)


class IngresoOut(BaseModel):
    id: int
    fecha: datetime
    producto_id: int
    descripcion: Optional[str]
    cantidad: float
    costo_unit: float
    venta_unit: float
    total_costo: float
    total_venta: float
    producto: ProductoOut

    class Config:
        from_attributes = True


# ---------- CAJA ----------
class AperturaCajaCreate(BaseModel):
    monto: float = Field(ge=0)
    notas: Optional[str] = None


class AperturaCajaOut(BaseModel):
    id: int
    fecha: datetime
    monto: float
    notas: Optional[str]

    class Config:
        from_attributes = True


class CierreCajaCreate(BaseModel):
    total_real: float
    notas: Optional[str] = None


class CierreCajaOut(BaseModel):
    id: int
    fecha_cierre: datetime
    monto_apertura: float = 0
    total_ventas_efectivo: float = 0
    total_esperado: float
    total_real: float
    diferencia: float
    total_efectivo: float
    total_sinpe: float
    total_tarjeta: float
    cantidad_ventas: int
    monto_bonificado: float = 0  # Total regalías
    notas: Optional[str]

    class Config:
        from_attributes = True


class ResumenCaja(BaseModel):
    total_dia: float
    cantidad_ventas: int
    total_efectivo: float
    total_sinpe: float
    total_tarjeta: float
    monto_apertura: float = 0
    total_esperado_cierre: float = 0
    tiene_apertura: bool = False
    monto_bonificado: float = 0
    monto_descuentos: float = 0
    fecha_inicio_turno: Optional[datetime] = None  # Desde cuándo cuenta el turno


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
    total_descuentos: float = 0
    total_regalias: float = 0
    costo_regalias: float = 0    # Costo absorbido por regalías


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
