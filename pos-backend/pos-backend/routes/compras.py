"""Endpoints de compras con regalías de proveedor y descuentos."""
from datetime import date, datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from database import get_db
import models
import schemas
from security import get_current_user

router = APIRouter(
    prefix="/compras",
    tags=["Compras"],
    dependencies=[Depends(get_current_user)],
)


@router.post("/", response_model=schemas.CompraOut, status_code=201)
def registrar_compra(compra: schemas.CompraCreate, db: Session = Depends(get_db)):
    if not compra.detalles:
        raise HTTPException(status_code=400, detail="La compra debe tener al menos un producto")

    ids_productos = [d.producto_id for d in compra.detalles]
    productos = {
        p.id: p for p in db.query(models.Producto).filter(
            models.Producto.id.in_(ids_productos)
        ).all()
    }

    subtotal = 0.0
    detalles_a_crear = []

    for detalle in compra.detalles:
        producto = productos.get(detalle.producto_id)
        if not producto:
            raise HTTPException(
                status_code=404,
                detail=f"Producto {detalle.producto_id} no encontrado"
            )

        cantidad = float(detalle.cantidad)

        if detalle.es_regalia:
            # Regalía: stock aumenta pero no se cobra ni afecta costo promedio
            costo_unit = 0.0
            sub = 0.0
        else:
            costo_unit = float(detalle.costo_unit)
            sub = round(costo_unit * cantidad, 2)
            subtotal += sub

        detalles_a_crear.append({
            "producto_id": producto.id,
            "cantidad": cantidad,
            "costo_unit": costo_unit,
            "es_regalia": detalle.es_regalia,
        })

    # Aplicar descuento
    descuento = round(min(compra.descuento_monto, subtotal), 2) if compra.descuento_monto > 0 else 0
    subtotal_con_descuento = subtotal - descuento

    # Aplicar IVA
    iva = 0.0
    if compra.iva_monto > 0:
        iva += compra.iva_monto
    if compra.iva_porcentaje > 0:
        iva += subtotal_con_descuento * (compra.iva_porcentaje / 100)
    iva = round(iva, 2)

    total = round(subtotal_con_descuento + iva, 2)
    if total < 0:
        total = 0

    # ATÓMICO: crear compra + actualizar stocks/costos
    try:
        db_compra = models.Compra(
            proveedor=compra.proveedor,
            descuento=descuento,
            iva=iva,
            total=total,
        )
        db.add(db_compra)
        db.flush()

        for d in detalles_a_crear:
            db.add(models.DetalleCompra(compra_id=db_compra.id, **d))
            producto = productos[d["producto_id"]]
            producto.stock += d["cantidad"]
            # Solo actualizar costo si NO es regalía y tiene costo > 0
            if not d["es_regalia"] and d["costo_unit"] > 0:
                producto.costo = d["costo_unit"]

        db.commit()
        db.refresh(db_compra)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al guardar compra: {str(e)}")

    return (
        db.query(models.Compra)
        .options(
            joinedload(models.Compra.detalles)
            .joinedload(models.DetalleCompra.producto)
        )
        .filter(models.Compra.id == db_compra.id)
        .first()
    )


@router.get("/", response_model=List[schemas.CompraOut])
def listar_compras(
    fecha_inicio: Optional[date] = None,
    fecha_fin: Optional[date] = None,
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db)
):
    query = db.query(models.Compra).options(
        joinedload(models.Compra.detalles).joinedload(models.DetalleCompra.producto)
    )
    if fecha_inicio:
        query = query.filter(
            models.Compra.fecha >= datetime.combine(fecha_inicio, datetime.min.time())
        )
    if fecha_fin:
        fin = datetime.combine(fecha_fin, datetime.min.time()) + timedelta(days=1)
        query = query.filter(models.Compra.fecha < fin)
    return query.order_by(models.Compra.fecha.desc()).limit(limit).all()


@router.get("/{compra_id}", response_model=schemas.CompraOut)
def obtener_compra(compra_id: int, db: Session = Depends(get_db)):
    compra = (
        db.query(models.Compra)
        .options(
            joinedload(models.Compra.detalles)
            .joinedload(models.DetalleCompra.producto)
        )
        .filter(models.Compra.id == compra_id)
        .first()
    )
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")
    return compra


@router.delete("/{compra_id}", status_code=204)
def eliminar_compra(compra_id: int, db: Session = Depends(get_db)):
    compra = (
        db.query(models.Compra)
        .options(joinedload(models.Compra.detalles))
        .filter(models.Compra.id == compra_id)
        .first()
    )
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")

    try:
        for detalle in compra.detalles:
            producto = db.query(models.Producto).filter(
                models.Producto.id == detalle.producto_id
            ).first()
            if producto:
                producto.stock = max(0, producto.stock - detalle.cantidad)
        db.delete(compra)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
