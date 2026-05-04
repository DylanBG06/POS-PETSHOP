"""
Endpoints de ventas.

Cambios v2:
- cantidad es Float (soporta venta por peso)
- guarda costo_unit en cada detalle (costo congelado al momento de la venta)
- valida tipo_venta del producto
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
    prefix="/ventas",
    tags=["Ventas"],
    dependencies=[Depends(get_current_user)],
)

METODOS_PAGO_VALIDOS = {"efectivo", "sinpe", "tarjeta"}


@router.post("/", response_model=schemas.VentaOut, status_code=201)
def registrar_venta(
    venta: schemas.VentaCreate,
    db: Session = Depends(get_db),
    usuario: models.Usuario = Depends(get_current_user),
):
    if venta.metodo_pago.lower() not in METODOS_PAGO_VALIDOS:
        raise HTTPException(
            status_code=400,
            detail=f"Método de pago inválido. Use: {', '.join(METODOS_PAGO_VALIDOS)}"
        )

    if not venta.detalles:
        raise HTTPException(status_code=400, detail="La venta debe tener al menos un producto")

    # Cargar productos
    ids_productos = [d.producto_id for d in venta.detalles]
    productos = {
        p.id: p for p in db.query(models.Producto).filter(
            models.Producto.id.in_(ids_productos)
        ).all()
    }

    # Validar y calcular
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

        cantidad = float(detalle.cantidad)

        # Para productos por unidad, exigir cantidad entera
        if producto.tipo_venta == "unidad" and cantidad != int(cantidad):
            raise HTTPException(
                status_code=400,
                detail=f"'{producto.nombre}' se vende por unidades, la cantidad debe ser entera"
            )

        if producto.stock < cantidad:
            unidad_str = (
                f" {producto.unidad_medida}" if producto.tipo_venta == "peso" else " unidades"
            )
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Stock insuficiente para '{producto.nombre}'. "
                    f"Disponible: {producto.stock}{unidad_str}, solicitado: {cantidad}{unidad_str}"
                )
            )

        subtotal_linea = round(producto.precio_venta * cantidad, 2)
        subtotal_total += subtotal_linea

        detalles_a_crear.append({
            "producto_id": producto.id,
            "cantidad": cantidad,
            "precio_unit": producto.precio_venta,
            "costo_unit": producto.costo,  # Congelar el costo actual
            "subtotal": subtotal_linea,
        })

    subtotal_total = round(subtotal_total, 2)
    total = subtotal_total

    # Validar efectivo
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

    # Crear venta
    db_venta = models.Venta(
        subtotal=subtotal_total,
        total=total,
        metodo_pago=venta.metodo_pago.lower(),
        monto_recibido=monto_recibido,
        vuelto=vuelto,
        usuario_id=usuario.id,
    )
    db.add(db_venta)
    db.flush()

    for d in detalles_a_crear:
        db.add(models.DetalleVenta(venta_id=db_venta.id, **d))
        productos[d["producto_id"]].stock -= d["cantidad"]

    db.commit()
    db.refresh(db_venta)

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
