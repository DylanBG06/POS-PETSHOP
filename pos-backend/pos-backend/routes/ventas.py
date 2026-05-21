"""Endpoints de ventas con pagos divididos (efectivo + sinpe + tarjeta)."""
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
            raise HTTPException(status_code=404, detail=f"Producto {detalle.producto_id} no encontrado")
        if not producto.activo:
            raise HTTPException(status_code=400, detail=f"Producto '{producto.nombre}' no está activo")
        cantidad = float(detalle.cantidad)
        if producto.stock < cantidad:
            raise HTTPException(status_code=400, detail=f"Stock insuficiente para '{producto.nombre}'. Hay {producto.stock}, querés vender {cantidad}")

        if detalle.es_regalia:
            precio_unit = 0.0
            descuento_item = 0.0
            sub = 0.0
            monto_regalias += producto.precio_venta * cantidad
        else:
            precio_unit = producto.precio_venta
            sub_bruto = round(precio_unit * cantidad, 2)
            desc_m = float(detalle.descuento_monto) if detalle.descuento_monto else 0
            desc_p = float(detalle.descuento_porcentaje) if detalle.descuento_porcentaje else 0
            descuento_item = round(min(sub_bruto, desc_m + (sub_bruto * desc_p / 100)), 2)
            sub = round(sub_bruto - descuento_item, 2)
            subtotal_normal += sub_bruto
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

    total = round(sum(d["subtotal"] for d in detalles_a_crear), 2)
    descuento = round(descuento_total_venta, 2)

    # ─────── PAGOS DIVIDIDOS ───────
    monto_efectivo = round(float(venta.monto_efectivo or 0), 2)
    monto_sinpe = round(float(venta.monto_sinpe or 0), 2)
    monto_tarjeta = round(float(venta.monto_tarjeta or 0), 2)

    # Si vino del modo viejo (metodo_pago único) y no pasaron los montos divididos:
    if monto_efectivo == 0 and monto_sinpe == 0 and monto_tarjeta == 0 and venta.metodo_pago:
        if venta.metodo_pago == "efectivo":
            monto_efectivo = total
        elif venta.metodo_pago == "sinpe":
            monto_sinpe = total
        elif venta.metodo_pago == "tarjeta":
            monto_tarjeta = total

    suma_pagos = round(monto_efectivo + monto_sinpe + monto_tarjeta, 2)

    # Validar que la suma cubra el total
    if total > 0 and abs(suma_pagos - total) > 0.01:
        # Si pagó MENOS, error
        if suma_pagos < total:
            raise HTTPException(
                status_code=400,
                detail=f"La suma de los pagos (₡{suma_pagos}) no cubre el total (₡{total}). Falta ₡{round(total - suma_pagos, 2)}"
            )
        # Si pagó MÁS y NO hay efectivo, error (no hay de dónde dar vuelto)
        if monto_efectivo == 0:
            raise HTTPException(
                status_code=400,
                detail=f"La suma de SINPE y tarjeta (₡{suma_pagos}) excede el total (₡{total})"
            )

    # Cálculo de vuelto: solo aplica al efectivo
    vuelto = 0.0
    monto_recibido = venta.monto_recibido
    if monto_efectivo > 0:
        # Si el cliente pagó con efectivo y dieron monto_recibido, calcular vuelto
        if monto_recibido is not None and monto_recibido > monto_efectivo:
            vuelto = round(monto_recibido - monto_efectivo, 2)
        else:
            monto_recibido = monto_efectivo
    else:
        monto_recibido = None

    # Determinar metodo_pago para mostrar en listados
    metodos_usados = []
    if monto_efectivo > 0: metodos_usados.append("efectivo")
    if monto_sinpe > 0: metodos_usados.append("sinpe")
    if monto_tarjeta > 0: metodos_usados.append("tarjeta")

    if len(metodos_usados) == 0:
        metodo_pago = "efectivo"  # default si total = 0 (venta regalada completa)
    elif len(metodos_usados) == 1:
        metodo_pago = metodos_usados[0]
    else:
        metodo_pago = "mixto"

    # ATÓMICO: crear venta + descontar stock
    try:
        db_venta = models.Venta(
            subtotal=round(subtotal_normal, 2),
            descuento=descuento,
            monto_regalias=round(monto_regalias, 2),
            total=total,
            metodo_pago=metodo_pago,
            monto_recibido=monto_recibido,
            vuelto=vuelto,
            monto_efectivo=monto_efectivo,
            monto_sinpe=monto_sinpe,
            monto_tarjeta=monto_tarjeta,
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
        query = query.filter(models.Venta.fecha >= datetime.combine(fecha_inicio, datetime.min.time()))
    if fecha_fin:
        fin = datetime.combine(fecha_fin, datetime.min.time()) + timedelta(days=1)
        query = query.filter(models.Venta.fecha < fin)
    return query.order_by(models.Venta.fecha.desc()).limit(limit).all()


@router.get("/{venta_id}", response_model=schemas.VentaOut)
def obtener_venta(venta_id: int, db: Session = Depends(get_db)):
    venta = (
        db.query(models.Venta)
        .options(joinedload(models.Venta.detalles).joinedload(models.DetalleVenta.producto))
        .filter(models.Venta.id == venta_id)
        .first()
    )
    if not venta:
        raise HTTPException(status_code=404, detail="Venta no encontrada")
    return venta
