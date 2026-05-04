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

    # Tipo de venta:
    # - 'unidad': se vende por unidades enteras
    # - 'peso': se vende por peso variable (kg o g)
    tipo_venta = Column(String(10), nullable=False, default="unidad")
    unidad_medida = Column(String(5), nullable=True)  # 'kg', 'g', None para unidad

    # precio_venta: si tipo='peso', es precio por kg/g según unidad_medida
    precio_venta = Column(Float, nullable=False)
    costo = Column(Float, nullable=False, default=0)

    # Stock como Float para soportar productos por peso (28.5 kg)
    stock = Column(Float, nullable=False, default=0)
    stock_minimo = Column(Float, nullable=False, default=5)

    categoria_id = Column(Integer, ForeignKey("categorias.id"), nullable=True)
    fecha_vencimiento = Column(Date, nullable=True)
    activo = Column(Boolean, default=True)

    categoria = relationship("Categoria", back_populates="productos")
    detalles_venta = relationship("DetalleVenta", back_populates="producto")
    detalles_compra = relationship("DetalleCompra", back_populates="producto")


class Venta(Base):
    __tablename__ = "ventas"

    id = Column(Integer, primary_key=True, index=True)
    fecha = Column(DateTime, default=datetime.now, index=True)
    subtotal = Column(Float, nullable=False)
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

    # Float para soportar peso variable (1.5 kg, 250 g, etc.)
    cantidad = Column(Float, nullable=False)
    precio_unit = Column(Float, nullable=False)
    # Costo congelado al momento de la venta - clave para reportes históricos
    costo_unit = Column(Float, nullable=False, default=0)
    subtotal = Column(Float, nullable=False)

    venta = relationship("Venta", back_populates="detalles")
    producto = relationship("Producto", back_populates="detalles_venta")


class Compra(Base):
    __tablename__ = "compras"

    id = Column(Integer, primary_key=True, index=True)
    fecha = Column(DateTime, default=datetime.now, index=True)
    proveedor = Column(String(100), nullable=True)
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
    # Float para soportar productos por peso (compraste 30 kg)
    cantidad = Column(Float, nullable=False)
    costo_unit = Column(Float, nullable=False)

    compra = relationship("Compra", back_populates="detalles")
    producto = relationship("Producto", back_populates="detalles_compra")


class CierreCaja(Base):
    __tablename__ = "cierres_caja"

    id = Column(Integer, primary_key=True, index=True)
    fecha_cierre = Column(DateTime, default=datetime.now, index=True)
    total_esperado = Column(Float, nullable=False)
    total_real = Column(Float, nullable=False)
    diferencia = Column(Float, nullable=False)
    total_efectivo = Column(Float, default=0)
    total_sinpe = Column(Float, default=0)
    total_tarjeta = Column(Float, default=0)
    cantidad_ventas = Column(Integer, default=0)
    notas = Column(String(500), nullable=True)


class Configuracion(Base):
    __tablename__ = "configuracion"

    id = Column(Integer, primary_key=True, index=True)
    clave = Column(String(50), unique=True, nullable=False)
    valor = Column(String(200), nullable=False)
