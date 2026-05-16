"""Endpoints de ingresos de inventario - sistema simple para registrar entrada de mercancía."""
from datetime import date, datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from database import get_db
import models
import schemas
from security import get_current_user

router = APIRouter(
    prefix="/ingresos",
    tags=["Ingresos"],
    dependencies=[Depends(get_current_user)],
)


def _serializar(ingreso: models.Ingreso) -> dict:
    cantidad = float(ingreso.cantidad or 0)
    costo = float(ingreso.costo_unit or 0)
    venta = float(ingreso.venta_unit or 0)
    return {
        "id": ingreso.id,
        "fecha": ingreso.fecha,
        "producto_id": ingreso.producto_id,
        "descripcion": ingreso.descripcion,
        "cantidad": cantidad,
        "costo_unit": costo,
        "venta_unit": venta,
        "total_costo": round(cantidad * costo, 2),
        "total_venta": round(cantidad * venta, 2),
        "producto": ingreso.producto,
    }


@router.post("/", status_code=201)
def registrar_ingreso(ingreso: schemas.IngresoCreate, db: Session = Depends(get_db)):
    producto = db.query(models.Producto).filter(
        models.Producto.id == ingreso.producto_id
    ).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    try:
        db_ingreso = models.Ingreso(
            producto_id=ingreso.producto_id,
            descripcion=ingreso.descripcion,
            cantidad=ingreso.cantidad,
            costo_unit=ingreso.costo_unit,
            venta_unit=ingreso.venta_unit,
        )
        db.add(db_ingreso)

        # Actualizar stock y precios del producto
        producto.stock = round((producto.stock or 0) + ingreso.cantidad, 4)
        if ingreso.costo_unit > 0:
            producto.costo = ingreso.costo_unit
        if ingreso.venta_unit > 0:
            producto.precio_venta = ingreso.venta_unit

        db.commit()
        db.refresh(db_ingreso)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al registrar: {str(e)}")

    return _serializar(db_ingreso)


@router.get("/")
def listar_ingresos(
    fecha_inicio: Optional[date] = None,
    fecha_fin: Optional[date] = None,
    limit: int = Query(200, le=1000),
    db: Session = Depends(get_db)
):
    query = db.query(models.Ingreso).options(joinedload(models.Ingreso.producto))
    if fecha_inicio:
        query = query.filter(
            models.Ingreso.fecha >= datetime.combine(fecha_inicio, datetime.min.time())
        )
    if fecha_fin:
        fin = datetime.combine(fecha_fin, datetime.min.time()) + timedelta(days=1)
        query = query.filter(models.Ingreso.fecha < fin)
    ingresos = query.order_by(models.Ingreso.fecha.desc()).limit(limit).all()
    return [_serializar(i) for i in ingresos]


@router.delete("/{ingreso_id}", status_code=204)
def eliminar_ingreso(ingreso_id: int, db: Session = Depends(get_db)):
    ingreso = db.query(models.Ingreso).filter(models.Ingreso.id == ingreso_id).first()
    if not ingreso:
        raise HTTPException(status_code=404, detail="Ingreso no encontrado")

    try:
        # Reversar el stock
        producto = db.query(models.Producto).filter(
            models.Producto.id == ingreso.producto_id
        ).first()
        if producto:
            producto.stock = max(0, round((producto.stock or 0) - ingreso.cantidad, 4))

        db.delete(ingreso)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
