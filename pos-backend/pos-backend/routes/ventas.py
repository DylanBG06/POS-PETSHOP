"""Endpoints de ventas con soporte para regalías y descuentos."""
from datetime import date, datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from database import get_db
import models
import schemas
from security import get_current_user

router = APIRouter(
    prefix="/ventas",
    tags=["Ventas"],
    dependencies=[Depends(get_current_user)],
)


@router.post("/", response_model=schemas.VentaOut, status_code=201)
def crear_venta(venta: schemas.VentaCreate, db: Session = Depends(get_db)):
    if not venta.detalles:
        raise HTTPException(status_code=400, detail="La venta debe tener al menos un producto")

    if venta.metodo_pago not in ("efectivo", "sinpe", "tarjeta"):
        raise HTTPException(status_code=400, detail="Método de pago inválido")

    # Cargar productos
    ids_productos = [d.producto_id for d in venta.detalles]
    productos = {
        p.id: p for p in db.query(models.Producto).filter(
            models.Producto.id.in_(ids_productos)
        ).all()
    }

    subtotal_normal = 0.0
    monto_regalias = 0.0
    descuento_total_venta = 0.0
    detalles_a_crear = []

    for detalle in venta.detalles:
        producto = productos.get(detalle.producto_id)
        if not producto:
            raise HTTPException(
                status_code=404,
                detail=f"Producto {detalle.producto_id} no encontrado"
            )

        if not producto.activo:
            raise HTTPException(
                status_code=400,
                detail=f"Producto '{producto.nombre}' no está activo"
            )

        cantidad = float(detalle.cantidad)

        if producto.stock < cantidad:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente para '{producto.nombre}'. Hay {producto.stock}, intentás vender {cantidad}"
            )

        if detalle.es_regalia:
            precio_unit = 0.0
            descuento_item = 0.0
            sub = 0.0
            monto_regalias += producto.precio_venta * cantidad
        else:
            precio_unit = producto.precio_venta
            sub_bruto = round(precio_unit * cantidad, 2)
            # Descuento por item
            desc_m = float(detalle.descuento_monto) if detalle.descuento_monto else 0
            desc_p = float(detalle.descuento_porcentaje) if detalle.descuento_porcentaje else 0
            descuento_item = round(min(sub_bruto, desc_m + (sub_bruto * desc_p / 100)), 2)
            sub = round(sub_bruto - descuento_item, 2)
            subtotal_normal += sub_bruto  # Subtotal antes de descuentos
            descuento_total_venta += descuento_item

        detalles_a_crear.append({
            "producto_id": producto.id,
            "cantidad": cantidad,
            "precio_unit": precio_unit,
            "costo_unit": producto.costo,
            "descuento_item": descuento_item if not detalle.es_regalia else 0,
            "subtotal": sub,
            "es_regalia": detalle.es_regalia,
        })

    # Total = suma de subtotales ya descontados (los descuentos por item ya se aplicaron)
    total = round(sum(d["subtotal"] for d in detalles_a_crear), 2)
    descuento = round(descuento_total_venta, 2)

    # Validar pago en efectivo
    vuelto = 0.0
    monto_recibido = venta.monto_recibido
    if venta.metodo_pago == "efectivo":
        if monto_recibido is None:
            raise HTTPException(status_code=400, detail="Falta el monto recibido en efectivo")
        if monto_recibido < total:
            raise HTTPException(
                status_code=400,
                detail=f"Monto recibido ({monto_recibido}) insuficiente. Total: {total}"
            )
        vuelto = round(monto_recibido - total, 2)
    else:
        monto_recibido = None

    # ATÓMICO: crear venta + descontar stock
    try:
        db_venta = models.Venta(
            subtotal=round(subtotal_normal, 2),
            descuento=descuento,
            monto_regalias=round(monto_regalias, 2),
            total=total,            metodo_pago=venta.metodo_pago,
            monto_recibido=monto_recibido,
            vuelto=vuelto,
        )
        db.add(db_venta)
        db.flush()

        for d in detalles_a_crear:
            db.add(models.DetalleVenta(venta_id=db_venta.id, **d))
            productos[d["producto_id"]].stock -= d["cantidad"]

        db.commit()
        db.refresh(db_venta)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al guardar venta: {str(e)}")

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
    query = db.query(models.Venta).options(
        joinedload(models.Venta.detalles).joinedload(models.DetalleVenta.producto)
    )
    if fecha_inicio:
        query = query.filter(
            models.Venta.fecha >= datetime.combine(fecha_inicio, datetime.min.time())
        )
    if fecha_fin:
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
