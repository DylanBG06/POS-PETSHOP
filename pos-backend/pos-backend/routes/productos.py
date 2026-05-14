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
    Desglose simple O multi-formato (atómico, robusto ante decimales).
    """
    import math

    padre = db.query(models.Producto).filter(models.Producto.id == producto_id).first()
    if not padre:
        raise HTTPException(status_code=404, detail="Producto padre no encontrado")

    if padre.tipo_producto != "COMPRABLE":
        raise HTTPException(status_code=400, detail="Solo se pueden desglosar productos COMPRABLES")

    # Helpers para validar números
    def es_numero_valido(n):
        try:
            f = float(n)
            return not (math.isnan(f) or math.isinf(f)) and f > 0
        except (TypeError, ValueError):
            return False

    # Construir lista de operaciones
    operaciones = []
    total_padres_a_consumir = 0.0

    try:
        if req.items and len(req.items) > 0:
            # MODO MULTI
            for item in req.items:
                if not es_numero_valido(item.cantidad_padres):
                    raise HTTPException(status_code=400, detail=f"Cantidad inválida para hijo {item.hijo_id}")

                hijo = db.query(models.Producto).filter(
                    models.Producto.id == item.hijo_id,
                    models.Producto.id_padre == producto_id,
                    models.Producto.activo == True,
                ).first()
                if not hijo:
                    raise HTTPException(
                        status_code=404,
                        detail=f"El hijo id={item.hijo_id} no existe o no pertenece a este padre"
                    )
                if not hijo.factor_conversion or hijo.factor_conversion <= 0:
                    raise HTTPException(status_code=400, detail=f"Factor inválido para hijo {hijo.nombre}")

                cantidad_padres = float(item.cantidad_padres)
                unidades = cantidad_padres * float(hijo.factor_conversion)
                operaciones.append((hijo, unidades, cantidad_padres))
                total_padres_a_consumir += cantidad_padres

        elif req.cantidad_padres and req.hijo_id:
            # MODO SIMPLE
            if not es_numero_valido(req.cantidad_padres):
                raise HTTPException(status_code=400, detail="Cantidad inválida")

            hijo = db.query(models.Producto).filter(
                models.Producto.id == req.hijo_id,
                models.Producto.id_padre == producto_id,
                models.Producto.activo == True,
            ).first()
            if not hijo:
                raise HTTPException(status_code=404, detail="El hijo no existe o no pertenece a este padre")
            if not hijo.factor_conversion or hijo.factor_conversion <= 0:
                raise HTTPException(status_code=400, detail=f"Factor inválido para hijo {hijo.nombre}")

            cantidad_padres = float(req.cantidad_padres)
            unidades = cantidad_padres * float(hijo.factor_conversion)
            operaciones.append((hijo, unidades, cantidad_padres))
            total_padres_a_consumir = cantidad_padres
        else:
            raise HTTPException(
                status_code=400,
                detail="Especificá 'cantidad_padres + hijo_id' o una lista 'items'"
            )

        # Redondear total para evitar problemas de precisión (46/6=7.666... etc)
        total_padres_a_consumir = round(total_padres_a_consumir, 6)

        # Validar stock con tolerancia generosa de 0.01 (1%)
        if padre.stock < total_padres_a_consumir - 0.01:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente. Hay {padre.stock} disponibles, querés convertir {round(total_padres_a_consumir, 4)}."
            )

        # APLICAR ATÓMICAMENTE
        nuevo_stock_padre = padre.stock - total_padres_a_consumir

        # Limpiar restos diminutos por imprecisión decimal (< 0.01)
        if abs(nuevo_stock_padre) < 0.01:
            nuevo_stock_padre = 0
        # Asegurar que nunca quede negativo
        nuevo_stock_padre = max(0, nuevo_stock_padre)

        padre.stock = round(nuevo_stock_padre, 4)

        resumen = []
        for hijo, unidades, padres_consumidos in operaciones:
            # Redondear unidades a entero (no tiene sentido vender 6.999 bolsas)
            unidades_redondeadas = round(unidades)
            hijo.stock = round(hijo.stock + unidades_redondeadas, 4)
            if padre.costo > 0 and hijo.factor_conversion > 0:
                hijo.costo = round(float(padre.costo) / float(hijo.factor_conversion), 2)
            resumen.append({
                "hijo_id": hijo.id,
                "hijo_nombre": hijo.nombre,
                "unidades_generadas": unidades_redondeadas,
                "nuevo_stock": hijo.stock,
                "padres_consumidos": round(padres_consumidos, 4),
            })

        db.commit()

        return {
            "mensaje": f"Desglose completado: convertido en {len(operaciones)} formato(s)",
            "padre_stock_nuevo": padre.stock,
            "total_padres_consumidos": round(total_padres_a_consumir, 4),
            "operaciones": resumen,
        }

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al desglosar: {str(e)}")


@router.post("/{producto_id}/vincular-padre", response_model=schemas.ProductoOut)
def vincular_padre(
    producto_id: int,
    req: schemas.VincularPadreRequest,
    db: Session = Depends(get_db)
):
    """
    Vincula un producto huérfano (sin padre) como hijo de otro producto.
    Mantiene su stock e historial. Solo cambia tipo_producto, id_padre y factor_conversion.
    """
    producto = db.query(models.Producto).filter(models.Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    if producto.id == req.id_padre:
        raise HTTPException(status_code=400, detail="Un producto no puede ser padre de sí mismo")

    padre = db.query(models.Producto).filter(models.Producto.id == req.id_padre).first()
    if not padre:
        raise HTTPException(status_code=404, detail="Producto padre no encontrado")

    if padre.tipo_producto != "COMPRABLE":
        raise HTTPException(status_code=400, detail="El producto padre debe ser COMPRABLE")

    if padre.id_padre is not None:
        raise HTTPException(status_code=400, detail="El padre seleccionado ya es hijo de otro producto")

    try:
        producto.tipo_producto = "DERIVADO"
        producto.id_padre = req.id_padre
        producto.factor_conversion = req.factor_conversion
        # Recalcular costo automático si el padre tiene costo
        if padre.costo > 0:
            producto.costo = round(padre.costo / req.factor_conversion, 2)
        db.commit()
        db.refresh(producto)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al vincular: {str(e)}")

    return _producto_a_dict(producto, db)


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


@router.get("/utils/huerfanos", response_model=List[schemas.ProductoOut])
def listar_huerfanos(db: Session = Depends(get_db)):
    """
    Productos sin padre que podrían vincularse:
    activos, sin id_padre, y que NO tienen hijos (no son padres ya).
    """
    todos = db.query(models.Producto).options(
        joinedload(models.Producto.categoria)
    ).filter(
        models.Producto.activo == True,
        models.Producto.id_padre == None,
    ).all()

    # Filtrar los que ya son padres de otros
    ids_que_son_padres = set(
        row[0] for row in db.query(models.Producto.id_padre)
        .filter(models.Producto.id_padre != None).distinct().all()
    )
    huerfanos = [p for p in todos if p.id not in ids_que_son_padres]
    return [_producto_a_dict(p, db) for p in huerfanos]


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
