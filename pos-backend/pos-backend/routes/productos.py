"""
Endpoints de productos e inventario.
"""
from datetime import date, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_

from database import get_db
import models
import schemas
from security import get_current_user

router = APIRouter(
    prefix="/productos",
    tags=["Productos"],
    dependencies=[Depends(get_current_user)],
)


def _validar_tipo_venta(producto_data, es_update=False):
    """Valida coherencia entre tipo_venta y unidad_medida."""
    tipo = producto_data.get("tipo_venta") if isinstance(producto_data, dict) else producto_data.tipo_venta
    unidad = producto_data.get("unidad_medida") if isinstance(producto_data, dict) else producto_data.unidad_medida

    if tipo == "peso" and not unidad:
        raise HTTPException(
            status_code=400,
            detail="Si tipo_venta='peso' debe especificar unidad_medida ('kg' o 'g')"
        )
    if tipo == "unidad" and unidad:
        # Limpiar unidad_medida si tipo es unidad
        if isinstance(producto_data, dict):
            producto_data["unidad_medida"] = None


@router.get("/", response_model=List[schemas.ProductoOut])
def listar_productos(
    buscar: Optional[str] = None,
    categoria_id: Optional[int] = None,
    solo_activos: bool = True,
    db: Session = Depends(get_db)
):
    query = db.query(models.Producto).options(joinedload(models.Producto.categoria))

    if solo_activos:
        query = query.filter(models.Producto.activo == True)

    if buscar:
        like = f"%{buscar}%"
        query = query.filter(or_(
            models.Producto.nombre.ilike(like),
            models.Producto.codigo.ilike(like)
        ))

    if categoria_id:
        query = query.filter(models.Producto.categoria_id == categoria_id)

    return query.order_by(models.Producto.nombre).all()


@router.get("/buscar-rapido", response_model=List[schemas.ProductoOut])
def buscar_rapido(q: str = Query(..., min_length=1), db: Session = Depends(get_db)):
    like = f"%{q}%"
    productos = (
        db.query(models.Producto)
        .options(joinedload(models.Producto.categoria))
        .filter(models.Producto.activo == True)
        .filter(models.Producto.stock > 0)
        .filter(or_(
            models.Producto.codigo == q,
            models.Producto.nombre.ilike(like),
            models.Producto.codigo.ilike(like)
        ))
        .limit(10)
        .all()
    )
    return productos


@router.get("/{producto_id}", response_model=schemas.ProductoOut)
def obtener_producto(producto_id: int, db: Session = Depends(get_db)):
    producto = db.query(models.Producto).filter(
        models.Producto.id == producto_id
    ).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return producto


@router.post("/", response_model=schemas.ProductoOut, status_code=201)
def crear_producto(
    producto: schemas.ProductoCreate,
    db: Session = Depends(get_db)
):
    if producto.codigo:
        existente = db.query(models.Producto).filter(
            models.Producto.codigo == producto.codigo
        ).first()
        if existente:
            raise HTTPException(
                status_code=400,
                detail=f"Ya existe un producto con el código {producto.codigo}"
            )

    datos = producto.model_dump()
    if datos["tipo_venta"] == "peso" and not datos.get("unidad_medida"):
        raise HTTPException(
            status_code=400,
            detail="Para venta por peso debe especificar unidad_medida ('kg' o 'g')"
        )
    if datos["tipo_venta"] == "unidad":
        datos["unidad_medida"] = None

    db_producto = models.Producto(**datos)
    db.add(db_producto)
    db.commit()
    db.refresh(db_producto)
    return db_producto


@router.put("/{producto_id}", response_model=schemas.ProductoOut)
def actualizar_producto(
    producto_id: int,
    producto: schemas.ProductoUpdate,
    db: Session = Depends(get_db)
):
    db_producto = db.query(models.Producto).filter(
        models.Producto.id == producto_id
    ).first()
    if not db_producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    datos = producto.model_dump(exclude_unset=True)

    # Validar código único
    if "codigo" in datos and datos["codigo"]:
        existente = db.query(models.Producto).filter(
            models.Producto.codigo == datos["codigo"],
            models.Producto.id != producto_id
        ).first()
        if existente:
            raise HTTPException(
                status_code=400,
                detail=f"Ya existe otro producto con el código {datos['codigo']}"
            )

    # Si cambia el tipo_venta, validar que no haya ventas previas
    if "tipo_venta" in datos and datos["tipo_venta"] != db_producto.tipo_venta:
        ventas_previas = db.query(models.DetalleVenta).filter(
            models.DetalleVenta.producto_id == producto_id
        ).count()
        if ventas_previas > 0:
            raise HTTPException(
                status_code=400,
                detail=(
                    "No se puede cambiar el tipo de venta porque ya hay ventas "
                    "registradas con este producto. Crea uno nuevo si es necesario."
                )
            )

    # Validar coherencia tipo_venta / unidad_medida
    nuevo_tipo = datos.get("tipo_venta", db_producto.tipo_venta)
    nueva_unidad = datos.get("unidad_medida", db_producto.unidad_medida)
    if nuevo_tipo == "peso" and not nueva_unidad:
        raise HTTPException(
            status_code=400,
            detail="Para venta por peso debe especificar unidad_medida"
        )
    if nuevo_tipo == "unidad":
        datos["unidad_medida"] = None

    for clave, valor in datos.items():
        setattr(db_producto, clave, valor)

    db.commit()
    db.refresh(db_producto)
    return db_producto


@router.delete("/{producto_id}", status_code=204)
def eliminar_producto(producto_id: int, db: Session = Depends(get_db)):
    """Eliminación lógica: marca como inactivo."""
    db_producto = db.query(models.Producto).filter(
        models.Producto.id == producto_id
    ).first()
    if not db_producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    db_producto.activo = False
    db.commit()


@router.get("/alertas/stock-bajo", response_model=List[schemas.ProductoOut])
def productos_stock_bajo(db: Session = Depends(get_db)):
    return (
        db.query(models.Producto)
        .options(joinedload(models.Producto.categoria))
        .filter(models.Producto.activo == True)
        .filter(models.Producto.stock <= models.Producto.stock_minimo)
        .order_by(models.Producto.stock)
        .all()
    )


@router.get("/alertas/por-vencer", response_model=List[schemas.ProductoOut])
def productos_por_vencer(
    dias: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db)
):
    limite = date.today() + timedelta(days=dias)
    return (
        db.query(models.Producto)
        .options(joinedload(models.Producto.categoria))
        .filter(models.Producto.activo == True)
        .filter(models.Producto.fecha_vencimiento != None)
        .filter(models.Producto.fecha_vencimiento <= limite)
        .order_by(models.Producto.fecha_vencimiento)
        .all()
    )
