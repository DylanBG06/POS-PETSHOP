"""Endpoints de caja: apertura, cierre, resumen, historial."""
from datetime import date, datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from database import get_db
import models
import schemas
from security import get_current_user

router = APIRouter(
    prefix="/caja",
    tags=["Caja"],
    dependencies=[Depends(get_current_user)],
)


def _ultimo_cierre_fecha(db: Session) -> Optional[datetime]:
    """Devuelve la fecha del último cierre, o None si nunca se ha cerrado."""
    ultimo = (
        db.query(models.CierreCaja)
        .order_by(models.CierreCaja.fecha_cierre.desc())
        .first()
    )
    return ultimo.fecha_cierre if ultimo else None


def _apertura_actual(db: Session) -> Optional[models.AperturaCaja]:
    """Devuelve la apertura del turno actual (posterior al último cierre)."""
    ultimo_cierre = _ultimo_cierre_fecha(db)
    query = db.query(models.AperturaCaja)
    if ultimo_cierre:
        query = query.filter(models.AperturaCaja.fecha > ultimo_cierre)
    return query.order_by(models.AperturaCaja.fecha.desc()).first()


def _calcular_resumen(db: Session, desde: datetime, hasta: datetime, apertura: Optional[models.AperturaCaja]) -> schemas.ResumenCaja:
    ventas = db.query(models.Venta).filter(
        models.Venta.fecha >= desde,
        models.Venta.fecha < hasta,
    ).all()

    total_dia = sum(v.total for v in ventas)
    # Usar los campos divididos en lugar de filtrar por metodo_pago
    total_efectivo = sum(getattr(v, 'monto_efectivo', 0) or 0 for v in ventas)
    total_sinpe = sum(getattr(v, 'monto_sinpe', 0) or 0 for v in ventas)
    total_tarjeta = sum(getattr(v, 'monto_tarjeta', 0) or 0 for v in ventas)
    monto_bonificado = sum(getattr(v, 'monto_regalias', 0) or 0 for v in ventas)
    monto_descuentos = sum(getattr(v, 'descuento', 0) or 0 for v in ventas)

    monto_apertura = apertura.monto if apertura else 0
    total_esperado = round(monto_apertura + total_efectivo, 2)

    return schemas.ResumenCaja(
        total_dia=round(total_dia, 2),
        cantidad_ventas=len(ventas),
        total_efectivo=round(total_efectivo, 2),
        total_sinpe=round(total_sinpe, 2),
        total_tarjeta=round(total_tarjeta, 2),
        monto_apertura=round(monto_apertura, 2),
        total_esperado_cierre=total_esperado,
        tiene_apertura=apertura is not None,
        monto_bonificado=round(monto_bonificado, 2),
        monto_descuentos=round(monto_descuentos, 2),
        fecha_inicio_turno=desde,
    )


@router.post("/apertura", response_model=schemas.AperturaCajaOut, status_code=201)
def registrar_apertura(req: schemas.AperturaCajaCreate, db: Session = Depends(get_db)):
    """Registra el monto con el que abre la caja al inicio del turno."""
    actual = _apertura_actual(db)
    if actual:
        raise HTTPException(
            status_code=400,
            detail=f"Ya hay una apertura registrada en este turno (₡{actual.monto}). Hacé un cierre primero."
        )

    db_apertura = models.AperturaCaja(monto=req.monto, notas=req.notas)
    db.add(db_apertura)
    db.commit()
    db.refresh(db_apertura)
    return db_apertura


@router.get("/apertura-hoy")
def obtener_apertura_hoy(db: Session = Depends(get_db)):
    """Devuelve la apertura del turno actual o 404 si no hay."""
    apertura = _apertura_actual(db)
    if not apertura:
        raise HTTPException(status_code=404, detail="No hay apertura registrada")
    return {
        "id": apertura.id,
        "fecha": apertura.fecha,
        "monto": apertura.monto,
        "notas": apertura.notas,
    }


@router.get("/resumen-hoy", response_model=schemas.ResumenCaja)
def resumen_hoy(db: Session = Depends(get_db)):
    """Resumen desde el último cierre (o desde el inicio del día si no hay cierres)."""
    apertura = _apertura_actual(db)
    ultimo_cierre = _ultimo_cierre_fecha(db)

    if ultimo_cierre:
        desde = ultimo_cierre
    else:
        desde = datetime.combine(date.today(), datetime.min.time())

    hasta = datetime.now() + timedelta(seconds=1)
    return _calcular_resumen(db, desde, hasta, apertura)


@router.post("/cierre", response_model=schemas.CierreCajaOut, status_code=201)
@router.post("/cerrar", response_model=schemas.CierreCajaOut, status_code=201)
def hacer_cierre(req: schemas.CierreCajaCreate, db: Session = Depends(get_db)):
    """Cierra el turno comparando el efectivo contado con el esperado."""
    apertura = _apertura_actual(db)
    ultimo_cierre = _ultimo_cierre_fecha(db)

    if ultimo_cierre:
        desde = ultimo_cierre
    else:
        desde = datetime.combine(date.today(), datetime.min.time())

    hasta = datetime.now() + timedelta(seconds=1)
    resumen = _calcular_resumen(db, desde, hasta, apertura)

    monto_apertura = apertura.monto if apertura else 0
    total_esperado = round(monto_apertura + resumen.total_efectivo, 2)
    diferencia = round(req.total_real - total_esperado, 2)

    db_cierre = models.CierreCaja(
        monto_apertura=monto_apertura,
        total_ventas_efectivo=resumen.total_efectivo,
        total_esperado=total_esperado,
        total_real=req.total_real,
        diferencia=diferencia,
        total_efectivo=resumen.total_efectivo,
        total_sinpe=resumen.total_sinpe,
        total_tarjeta=resumen.total_tarjeta,
        cantidad_ventas=resumen.cantidad_ventas,
        monto_bonificado=resumen.monto_bonificado,
        notas=req.notas,
    )
    db.add(db_cierre)
    db.commit()
    db.refresh(db_cierre)
    return db_cierre


@router.get("/cierres", response_model=List[schemas.CierreCajaOut])
def listar_cierres(limit: int = 30, db: Session = Depends(get_db)):
    return (
        db.query(models.CierreCaja)
        .order_by(models.CierreCaja.fecha_cierre.desc())
        .limit(limit)
        .all()
    )


@router.get("/cierres/{cierre_id}/ventas")
def ventas_de_cierre(cierre_id: int, db: Session = Depends(get_db)):
    """Devuelve las ventas y productos vendidos de un cierre específico."""
    cierre = db.query(models.CierreCaja).filter(models.CierreCaja.id == cierre_id).first()
    if not cierre:
        raise HTTPException(status_code=404, detail="Cierre no encontrado")

    cierre_anterior = (
        db.query(models.CierreCaja)
        .filter(models.CierreCaja.fecha_cierre < cierre.fecha_cierre)
        .order_by(models.CierreCaja.fecha_cierre.desc())
        .first()
    )

    desde = cierre_anterior.fecha_cierre if cierre_anterior else datetime.combine(
        cierre.fecha_cierre.date(), datetime.min.time()
    )
    hasta = cierre.fecha_cierre

    ventas = (
        db.query(models.Venta)
        .options(
            joinedload(models.Venta.detalles).joinedload(models.DetalleVenta.producto)
        )
        .filter(
            models.Venta.fecha >= desde,
            models.Venta.fecha <= hasta,
        )
        .order_by(models.Venta.fecha.desc())
        .all()
    )

    productos = {}
    for v in ventas:
        for d in v.detalles:
            key = d.producto_id
            if key not in productos:
                productos[key] = {
                    "nombre": d.producto.nombre,
                    "cantidad": 0,
                    "total": 0,
                    "cantidad_regalia": 0,
                }
            if getattr(d, 'es_regalia', False):
                productos[key]["cantidad_regalia"] += d.cantidad
            else:
                productos[key]["total"] += d.subtotal
            productos[key]["cantidad"] += d.cantidad

    return {
        "cierre_id": cierre.id,
        "fecha_cierre": cierre.fecha_cierre,
        "desde": desde,
        "hasta": hasta,
        "cantidad_ventas": len(ventas),
        "total_efectivo": cierre.total_efectivo,
        "total_sinpe": cierre.total_sinpe,
        "total_tarjeta": cierre.total_tarjeta,
        "monto_apertura": cierre.monto_apertura or 0,
        "total_esperado": cierre.total_esperado,
        "total_real": cierre.total_real,
        "diferencia": cierre.diferencia,
        "monto_bonificado": getattr(cierre, 'monto_bonificado', 0) or 0,
        "notas": cierre.notas,
        "productos_vendidos": sorted(
            list(productos.values()),
            key=lambda x: x["total"],
            reverse=True
        ),
    }


@router.delete("/cierres/{cierre_id}", status_code=204)
def eliminar_cierre(cierre_id: int, db: Session = Depends(get_db)):
    cierre = db.query(models.CierreCaja).filter(models.CierreCaja.id == cierre_id).first()
    if not cierre:
        raise HTTPException(status_code=404, detail="Cierre no encontrado")
    db.delete(cierre)
    db.commit()
