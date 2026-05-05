"""
Endpoints de ventas. Este es el módulo más crítico del POS.
Cada venta:
  1. Valida stock disponible
  2. Calcula totales
  3. Descuenta inventario
  4. Guarda la venta y sus detalles en una transacción
"""
from datetime import date, datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from database import get_db
import models
import schemas

router = APIRouter(prefix="/ventas", tags=["Ventas"])

METODOS_PAGO_VALIDOS = {"efectivo", "sinpe", "tarjeta"}


@router.post("/", response_model=schemas.VentaOut, status_code=201)
def registrar_venta(venta: schemas.VentaCreate, db: Session = Depends(get_db)):
    """
    Registra una venta completa de forma atómica.
    Si algo falla (ej. stock insuficiente), todo se revierte.
    """
    # Validar método de pago
    if venta.metodo_pago.lower() not in METODOS_PAGO_VALIDOS:
        raise HTTPException(
            status_code=400,
            detail=f"Método de pago inválido. Use: {', '.join(METODOS_PAGO_VALIDOS)}"
        )

    if not venta.detalles:
        raise HTTPException(status_code=400, detail="La venta debe tener al menos un producto")

    # Cargar todos los productos involucrados de una sola vez
    ids_productos = [d.producto_id for d in venta.detalles]
    productos = {
        p.id: p for p in db.query(models.Producto).filter(
            models.Producto.id.in_(ids_productos)
        ).all()
    }

    # Validar existencia y stock
    subtotal_total = 0.0
    detalles_a_crear = []
    for detalle in venta.detalles:
        producto = productos.get(detalle.producto_id)
        if not producto:
            raise HTTPException(
                status_code=404,
                detail=f"Producto con id {detalle.producto_id} no encontrado"
            )
        if not producto.activo:
            raise HTTPException(
                status_code=400,
                detail=f"El producto '{producto.nombre}' está inactivo"
            )
        if producto.stock < detalle.cantidad:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Stock insuficiente para '{producto.nombre}'. "
                    f"Disponible: {producto.stock}, solicitado: {detalle.cantidad}"
                )
            )

        subtotal_linea = round(producto.precio_venta * detalle.cantidad, 2)
        subtotal_total += subtotal_linea

        detalles_a_crear.append({
            "producto_id": producto.id,
            "cantidad": detalle.cantidad,
            "precio_unit": producto.precio_venta,
            "subtotal": subtotal_linea,
        })

    subtotal_total = round(subtotal_total, 2)
    total = subtotal_total  # Si en el futuro hay impuestos/descuentos, se calcula aquí

    # Validar monto recibido para efectivo
    vuelto = 0.0
    monto_recibido = venta.monto_recibido
    if venta.metodo_pago.lower() == "efectivo":
        if monto_recibido is None:
            raise HTTPException(
                status_code=400,
                detail="Para pago en efectivo debe ingresar el monto recibido"
            )
        if monto_recibido < total:
            raise HTTPException(
                status_code=400,
                detail=f"Monto recibido ({monto_recibido}) menor al total ({total})"
            )
        vuelto = round(monto_recibido - total, 2)

    # Crear la venta y sus detalles
    db_venta = models.Venta(
        subtotal=subtotal_total,
        total=total,
        metodo_pago=venta.metodo_pago.lower(),
        monto_recibido=monto_recibido,
        vuelto=vuelto,
    )
    db.add(db_venta)
    db.flush()  # Obtener el id sin hacer commit aún

    for d in detalles_a_crear:
        db.add(models.DetalleVenta(venta_id=db_venta.id, **d))
        # Descontar stock
        productos[d["producto_id"]].stock -= d["cantidad"]

    db.commit()
    db.refresh(db_venta)

    # Cargar relaciones para devolver respuesta completa
    return (
        db.query(models.Venta)
        .options(
            joinedload(models.Venta.detalles)
            .joinedload(models.DetalleVenta.producto)
        )
        .filter(models.Venta.id == db_venta.id)
        .first()
    )


@router.get("/", response_model=List[schemas.VentaOut])
def listar_ventas(
    fecha_inicio: Optional[date] = None,
    fecha_fin: Optional[date] = None,
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db)
):
    """Lista ventas con filtro opcional por rango de fechas."""
    query = db.query(models.Venta).options(
        joinedload(models.Venta.detalles).joinedload(models.DetalleVenta.producto)
    )

    if fecha_inicio:
        query = query.filter(
            models.Venta.fecha >= datetime.combine(fecha_inicio, datetime.min.time())
        )
    if fecha_fin:
        # Incluir todo el día final
        fin = datetime.combine(fecha_fin, datetime.min.time()) + timedelta(days=1)
        query = query.filter(models.Venta.fecha < fin)

    return query.order_by(models.Venta.fecha.desc()).limit(limit).all()


@router.get("/{venta_id}", response_model=schemas.VentaOut)
def obtener_venta(venta_id: int, db: Session = Depends(get_db)):
    venta = (
        db.query(models.Venta)
        .options(
            joinedload(models.Venta.detalles)
            .joinedload(models.DetalleVenta.producto)
        )
        .filter(models.Venta.id == venta_id)
        .first()
    )
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    return venta
