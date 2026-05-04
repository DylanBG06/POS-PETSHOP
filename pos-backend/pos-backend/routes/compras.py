"""
Endpoints de compras (reposición de inventario).
"""
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

    total_compra = 0.0
    detalles_a_crear = []
    for detalle in compra.detalles:
        producto = productos.get(detalle.producto_id)
        if not producto:
            raise HTTPException(
                status_code=404,
                detail=f"Producto con id {detalle.producto_id} no encontrado"
            )

        cantidad = float(detalle.cantidad)

        # Validar entero si es por unidad
        if producto.tipo_venta == "unidad" and cantidad != int(cantidad):
            raise HTTPException(
                status_code=400,
                detail=f"'{producto.nombre}' se compra por unidades, la cantidad debe ser entera"
            )

        subtotal = round(detalle.costo_unit * cantidad, 2)
        total_compra += subtotal

        detalles_a_crear.append({
            "producto_id": producto.id,
            "cantidad": cantidad,
            "costo_unit": detalle.costo_unit,
        })

    total_compra = round(total_compra, 2)

    db_compra = models.Compra(
        proveedor=compra.proveedor,
        total=total_compra,
    )
    db.add(db_compra)
    db.flush()

    for d in detalles_a_crear:
        db.add(models.DetalleCompra(compra_id=db_compra.id, **d))
        producto = productos[d["producto_id"]]
        producto.stock += d["cantidad"]
        producto.costo = d["costo_unit"]

    db.commit()
    db.refresh(db_compra)

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
