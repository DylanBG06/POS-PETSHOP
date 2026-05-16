"""
Modelos de la base de datos.
"""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Date,
    ForeignKey, Boolean
)
from sqlalchemy.orm import relationship
from database import Base


class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(200), nullable=False)
    nombre_completo = Column(String(100), nullable=True)
    is_admin = Column(Boolean, default=True)
    activo = Column(Boolean, default=True)
    creado = Column(DateTime, default=datetime.now)


class Categoria(Base):
    __tablename__ = "categorias"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(50), unique=True, nullable=False)

    productos = relationship("Producto", back_populates="categoria")


class Producto(Base):
    __tablename__ = "productos"

    id = Column(Integer, primary_key=True, index=True)
    codigo = Column(String(50), unique=True, index=True, nullable=True)
    nombre = Column(String(100), nullable=False, index=True)

    tipo_venta = Column(String(10), nullable=False, default="unidad")
    unidad_medida = Column(String(5), nullable=True)

    precio_venta = Column(Float, nullable=False)
    costo = Column(Float, nullable=False, default=0)

    stock = Column(Float, nullable=False, default=0)
    stock_minimo = Column(Float, nullable=False, default=5)

    categoria_id = Column(Integer, ForeignKey("categorias.id"), nullable=True)
    fecha_vencimiento = Column(Date, nullable=True)
    activo = Column(Boolean, default=True)

    # --- Jerarquía padre-hijo ---
    # COMPRABLE = se compra al proveedor (saco), DERIVADO = se genera del padre (bolsita)
    tipo_producto = Column(String(20), nullable=False, default="COMPRABLE")
    # ID del producto padre (NULL si es padre/independiente)
    id_padre = Column(Integer, ForeignKey("productos.id"), nullable=True)
    # Cuántas unidades del hijo salen de 1 padre (ej: 30 bolsas de 1kg de un saco de 30kg)
    factor_conversion = Column(Float, nullable=True)

    categoria = relationship("Categoria", back_populates="productos")
    detalles_venta = relationship("DetalleVenta", back_populates="producto")
    detalles_compra = relationship("DetalleCompra", back_populates="producto")
    # Relación: un producto puede tener hijos derivados
    hijos = relationship("Producto", foreign_keys=[id_padre])


class Venta(Base):
    __tablename__ = "ventas"

    id = Column(Integer, primary_key=True, index=True)
    fecha = Column(DateTime, default=datetime.now, index=True)
    subtotal = Column(Float, nullable=False)
    descuento = Column(Float, nullable=False, default=0)
    monto_regalias = Column(Float, nullable=False, default=0)
    total = Column(Float, nullable=False)
    metodo_pago = Column(String(20), nullable=False)
    monto_recibido = Column(Float, nullable=True)
    vuelto = Column(Float, nullable=True, default=0)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)

    detalles = relationship(
        "DetalleVenta",
        back_populates="venta",
        cascade="all, delete-orphan"
    )


class DetalleVenta(Base):
    __tablename__ = "detalle_venta"

    id = Column(Integer, primary_key=True, index=True)
    venta_id = Column(Integer, ForeignKey("ventas.id"), nullable=False)
    producto_id = Column(Integer, ForeignKey("productos.id"), nullable=False)

    cantidad = Column(Float, nullable=False)
    precio_unit = Column(Float, nullable=False)
    costo_unit = Column(Float, nullable=False, default=0)
    descuento_item = Column(Float, nullable=False, default=0)
    subtotal = Column(Float, nullable=False)
    es_regalia = Column(Boolean, nullable=False, default=False)

    venta = relationship("Venta", back_populates="detalles")
    producto = relationship("Producto", back_populates="detalles_venta")


class Compra(Base):
    __tablename__ = "compras"

    id = Column(Integer, primary_key=True, index=True)
    fecha = Column(DateTime, default=datetime.now, index=True)
    proveedor = Column(String(100), nullable=True)
    descuento = Column(Float, nullable=False, default=0)
    iva = Column(Float, nullable=False, default=0)
    total = Column(Float, nullable=False)

    detalles = relationship(
        "DetalleCompra",
        back_populates="compra",
        cascade="all, delete-orphan"
    )


class DetalleCompra(Base):
    __tablename__ = "detalle_compra"

    id = Column(Integer, primary_key=True, index=True)
    compra_id = Column(Integer, ForeignKey("compras.id"), nullable=False)
    producto_id = Column(Integer, ForeignKey("productos.id"), nullable=False)
    cantidad = Column(Float, nullable=False)
    costo_unit = Column(Float, nullable=False)
    es_regalia = Column(Boolean, nullable=False, default=False)

    compra = relationship("Compra", back_populates="detalles")
    producto = relationship("Producto", back_populates="detalles_compra")


class Ingreso(Base):
    """Registro simple de ingresos de inventario."""
    __tablename__ = "ingresos"

    id = Column(Integer, primary_key=True, index=True)
    fecha = Column(DateTime, default=datetime.now, index=True)
    producto_id = Column(Integer, ForeignKey("productos.id"), nullable=False)
    descripcion = Column(String(200), nullable=True)
    cantidad = Column(Float, nullable=False)
    costo_unit = Column(Float, nullable=False)
    venta_unit = Column(Float, nullable=False)

    producto = relationship("Producto")


class AperturaCaja(Base):
    __tablename__ = "aperturas_caja"

    id = Column(Integer, primary_key=True, index=True)
    fecha = Column(DateTime, default=datetime.now, index=True)
    monto = Column(Float, nullable=False)  # Dinero con que inicia la caja
    notas = Column(String(500), nullable=True)


class CierreCaja(Base):
    __tablename__ = "cierres_caja"

    id = Column(Integer, primary_key=True, index=True)
    fecha_cierre = Column(DateTime, default=datetime.now, index=True)
    monto_apertura = Column(Float, default=0)   # Con cuánto inició la caja
    total_ventas_efectivo = Column(Float, default=0)  # Ventas en efectivo del turno
    total_esperado = Column(Float, nullable=False)   # apertura + ventas efectivo
    total_real = Column(Float, nullable=False)       # Lo que contó el cajero
    diferencia = Column(Float, nullable=False)       # real - esperado
    total_efectivo = Column(Float, default=0)
    total_sinpe = Column(Float, default=0)
    total_tarjeta = Column(Float, default=0)
    cantidad_ventas = Column(Integer, default=0)
    monto_bonificado = Column(Float, default=0)
    notas = Column(String(500), nullable=True)


class Configuracion(Base):
    __tablename__ = "configuracion"

    id = Column(Integer, primary_key=True, index=True)
    clave = Column(String(50), unique=True, nullable=False)
    valor = Column(String(200), nullable=False)
