"""
Endpoints de productos e inventario.
Soporta jerarquía padre-hijo para productos que se desglosan (saco → bolsitas).
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


def _producto_a_dict(producto, db=None):
    """Convierte un Producto a dict con nombre_padre si aplica."""
    data = {
        "id": producto.id,
        "codigo": producto.codigo,
        "nombre": producto.nombre,
        "tipo_venta": producto.tipo_venta,
        "unidad_medida": producto.unidad_medida,
        "precio_venta": producto.precio_venta,
        "costo": producto.costo,
        "stock": producto.stock,
        "stock_minimo": producto.stock_minimo,
        "categoria_id": producto.categoria_id,
        "categoria": producto.categoria,
        "fecha_vencimiento": producto.fecha_vencimiento,
        "activo": producto.activo,
        "tipo_producto": producto.tipo_producto,
        "id_padre": producto.id_padre,
        "factor_conversion": producto.factor_conversion,
        "nombre_padre": None,
    }
    if producto.id_padre and db:
        padre = db.query(models.Producto).filter(
            models.Producto.id == producto.id_padre
        ).first()
        if padre:
            data["nombre_padre"] = padre.nombre
    return data


@router.get("/", response_model=List[schemas.ProductoOut])
def listar_productos(
    buscar: Optional[str] = None,
    categoria_id: Optional[int] = None,
    solo_activos: bool = True,
    solo_comprables: bool = False,
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

    if solo_comprables:
        query = query.filter(models.Producto.tipo_producto == "COMPRABLE")

    # Ordenar: padres primero, luego hijos agrupados bajo su padre
    todos = query.order_by(models.Producto.nombre).all()

    # Reorganizar para jerarquía: padres con hijos debajo
    padres = [p for p in todos if p.id_padre is None]
    hijos_map = {}
    for p in todos:
        if p.id_padre is not None:
            hijos_map.setdefault(p.id_padre, []).append(p)

    resultado = []
    for padre in padres:
        resultado.append(_producto_a_dict(padre, db))
        for hijo in hijos_map.get(padre.id, []):
            resultado.append(_producto_a_dict(hijo, db))

    # Agregar huérfanos (hijos cuyo padre no está en la lista)
    ids_resultado = {r["id"] for r in resultado}
    for p in todos:
        if p.id not in ids_resultado:
            resultado.append(_producto_a_dict(p, db))

    return resultado


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
    return [_producto_a_dict(p, db) for p in productos]


@router.get("/{producto_id}", response_model=schemas.ProductoOut)
def obtener_producto(producto_id: int, db: Session = Depends(get_db)):
    producto = db.query(models.Producto).options(
        joinedload(models.Producto.categoria)
    ).filter(models.Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return _producto_a_dict(producto, db)


@router.post("/", response_model=schemas.ProductoOut, status_code=201)
def crear_producto(producto: schemas.ProductoCreate, db: Session = Depends(get_db)):
    if producto.codigo:
        existente = db.query(models.Producto).filter(
            models.Producto.codigo == producto.codigo
        ).first()
        if existente:
            raise HTTPException(status_code=400, detail=f"Ya existe un producto con el código {producto.codigo}")

    datos = producto.model_dump()

    # Si es DERIVADO, validar padre y factor
    if datos["tipo_producto"] == "DERIVADO":
        if not datos.get("id_padre"):
            raise HTTPException(status_code=400, detail="Un producto DERIVADO necesita id_padre")
        if not datos.get("factor_conversion") or datos["factor_conversion"] <= 0:
            raise HTTPException(status_code=400, detail="factor_conversion debe ser > 0")
        padre = db.query(models.Producto).filter(models.Producto.id == datos["id_padre"]).first()
        if not padre:
            raise HTTPException(status_code=404, detail="Producto padre no encontrado")
        # Calcular costo automático
        datos["costo"] = round(padre.costo / datos["factor_conversion"], 2)
    else:
        datos["id_padre"] = None
        datos["factor_conversion"] = None

    if datos["tipo_venta"] == "unidad":
        datos["unidad_medida"] = None

    db_producto = models.Producto(**datos)
    db.add(db_producto)
    db.commit()
    db.refresh(db_producto)
    return _producto_a_dict(db_producto, db)


@router.put("/{producto_id}", response_model=schemas.ProductoOut)
def actualizar_producto(
    producto_id: int,
    producto: schemas.ProductoUpdate,
    db: Session = Depends(get_db)
):
    db_producto = db.query(models.Producto).filter(models.Producto.id == producto_id).first()
    if not db_producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    datos = producto.model_dump(exclude_unset=True)

    if "codigo" in datos and datos["codigo"]:
        existente = db.query(models.Producto).filter(
            models.Producto.codigo == datos["codigo"],
            models.Producto.id != producto_id
        ).first()
        if existente:
            raise HTTPException(status_code=400, detail=f"Ya existe otro producto con el código {datos['codigo']}")

    for clave, valor in datos.items():
        setattr(db_producto, clave, valor)

    db.commit()
    db.refresh(db_producto)
    return _producto_a_dict(db_producto, db)


@router.delete("/{producto_id}", status_code=204)
def eliminar_producto(producto_id: int, db: Session = Depends(get_db)):
    db_producto = db.query(models.Producto).filter(models.Producto.id == producto_id).first()
    if not db_producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    db_producto.activo = False
    db.commit()


@router.post("/{producto_id}/desglosar")
def desglosar_producto(
    producto_id: int,
    req: schemas.DesglosarRequest,
    db: Session = Depends(get_db)
):
    """
    Convertir N unidades del padre en unidades del hijo especificado.
    Ej: 1 saco de 30kg → 30 bolsas de 1kg (del hijo elegido).
    """
    padre = db.query(models.Producto).filter(models.Producto.id == producto_id).first()
    if not padre:
        raise HTTPException(status_code=404, detail="Producto padre no encontrado")

    if padre.tipo_producto != "COMPRABLE":
        raise HTTPException(status_code=400, detail="Solo se pueden desglosar productos COMPRABLES")

    # Buscar el hijo específico
    hijo = db.query(models.Producto).filter(
        models.Producto.id == req.hijo_id,
        models.Producto.id_padre == producto_id,
        models.Producto.activo == True,
    ).first()

    if not hijo:
        raise HTTPException(
            status_code=404,
            detail="El producto hijo no existe o no pertenece a este padre"
        )

    # Validar stock suficiente
    if padre.stock < req.cantidad_padres:
        raise HTTPException(
            status_code=400,
            detail=f"Stock insuficiente. Hay {int(padre.stock)} disponibles, querés convertir {req.cantidad_padres}."
        )

    # Descontar del padre
    padre.stock -= req.cantidad_padres

    # Sumar al hijo elegido
    unidades_generadas = req.cantidad_padres * hijo.factor_conversion
    hijo.stock += unidades_generadas
    # Recalcular costo del hijo
    hijo.costo = round(padre.costo / hijo.factor_conversion, 2)

    db.commit()

    return {
        "mensaje": f"Se desglosaron {req.cantidad_padres} unidad(es) de '{padre.nombre}' en {int(unidades_generadas)} unidad(es) de '{hijo.nombre}'",
        "padre_stock_nuevo": padre.stock,
        "hijo_stock_nuevo": hijo.stock,
        "unidades_generadas": unidades_generadas,
    }


@router.get("/{producto_id}/hijos", response_model=List[schemas.ProductoOut])
def obtener_hijos(producto_id: int, db: Session = Depends(get_db)):
    """Obtener productos derivados de un padre."""
    hijos = db.query(models.Producto).options(
        joinedload(models.Producto.categoria)
    ).filter(
        models.Producto.id_padre == producto_id,
        models.Producto.activo == True,
    ).all()
    return [_producto_a_dict(h, db) for h in hijos]


@router.get("/alertas/stock-bajo", response_model=List[schemas.ProductoOut])
def productos_stock_bajo(db: Session = Depends(get_db)):
    prods = (
        db.query(models.Producto)
        .options(joinedload(models.Producto.categoria))
        .filter(models.Producto.activo == True)
        .filter(models.Producto.stock <= models.Producto.stock_minimo)
        .order_by(models.Producto.stock)
        .all()
    )
    return [_producto_a_dict(p, db) for p in prods]


@router.get("/alertas/por-vencer", response_model=List[schemas.ProductoOut])
def productos_por_vencer(
    dias: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db)
):
    limite = date.today() + timedelta(days=dias)
    prods = (
        db.query(models.Producto)
        .options(joinedload(models.Producto.categoria))
        .filter(models.Producto.activo == True)
        .filter(models.Producto.fecha_vencimiento != None)
        .filter(models.Producto.fecha_vencimiento <= limite)
        .order_by(models.Producto.fecha_vencimiento)
        .all()
    )
    return [_producto_a_dict(p, db) for p in prods]
