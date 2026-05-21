"""Modelos SQLAlchemy del sistema POS."""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from database import Base


class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    nombre = Column(String(100), nullable=True)
    rol = Column(String(20), nullable=False, default="admin")
    debe_cambiar_password = Column(Boolean, nullable=False, default=False)
    activo = Column(Boolean, nullable=False, default=True)
    fecha_creacion = Column(DateTime, default=datetime.now)


class Categoria(Base):
    __tablename__ = "categorias"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(50), unique=True, nullable=False)
    color = Column(String(20), nullable=True)

    productos = relationship("Producto", back_populates="categoria")


class Producto(Base):
    __tablename__ = "productos"

    id = Column(Integer, primary_key=True, index=True)
    codigo = Column(String(50), nullable=True, index=True)
    nombre = Column(String(150), nullable=False, index=True)
    tipo_venta = Column(String(20), nullable=False, default="unidad")
    unidad_medida = Column(String(20), nullable=True)
    precio_venta = Column(Float, nullable=False)
    costo = Column(Float, nullable=False, default=0)
    stock = Column(Float, nullable=False, default=0)
    stock_minimo = Column(Float, nullable=False, default=5)
    categoria_id = Column(Integer, ForeignKey("categorias.id"), nullable=True)
    fecha_vencimiento = Column(String(20), nullable=True)
    activo = Column(Boolean, nullable=False, default=True)
    fecha_creacion = Column(DateTime, default=datetime.now)

    # Jerarquía padre/hijo (saco → bolsas)
    tipo_producto = Column(String(20), nullable=False, default="COMPRABLE")
    id_padre = Column(Integer, ForeignKey("productos.id"), nullable=True)
    factor_conversion = Column(Float, nullable=False, default=1)

    categoria = relationship("Categoria", back_populates="productos")
    detalles_venta = relationship("DetalleVenta", back_populates="producto")
    detalles_compra = relationship("DetalleCompra", back_populates="producto")


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
    # Pagos divididos
    monto_efectivo = Column(Float, nullable=False, default=0)
    monto_sinpe = Column(Float, nullable=False, default=0)
    monto_tarjeta = Column(Float, nullable=False, default=0)
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
    """Sistema viejo de compras (descontinuado, se mantiene la tabla para no romper FK)."""
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
    monto = Column(Float, nullable=False, default=0)
    notas = Column(String(500), nullable=True)


class CierreCaja(Base):
    __tablename__ = "cierres_caja"

    id = Column(Integer, primary_key=True, index=True)
    fecha_cierre = Column(DateTime, default=datetime.now, index=True)
    monto_apertura = Column(Float, nullable=False, default=0)
    total_ventas_efectivo = Column(Float, nullable=False, default=0)
    total_esperado = Column(Float, nullable=False, default=0)
    total_real = Column(Float, nullable=False, default=0)
    diferencia = Column(Float, nullable=False, default=0)
    total_efectivo = Column(Float, nullable=False, default=0)
    total_sinpe = Column(Float, nullable=False, default=0)
    total_tarjeta = Column(Float, nullable=False, default=0)
    cantidad_ventas = Column(Integer, default=0)
    monto_bonificado = Column(Float, default=0)
    notas = Column(String(500), nullable=True)


class Configuracion(Base):
    __tablename__ = "configuracion"

    id = Column(Integer, primary_key=True, index=True)
    clave = Column(String(50), unique=True, nullable=False)
    valor = Column(String(500), nullable=False)
