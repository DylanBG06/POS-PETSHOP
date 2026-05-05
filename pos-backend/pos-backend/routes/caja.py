"""
Endpoints de caja: resumen del día y cierre de caja.

Cambio clave: el resumen solo cuenta ventas DESPUÉS del último cierre.
Si no hay cierre previo hoy, cuenta desde medianoche.
Así al hacer cierre los valores se "resetean" a 0.
"""
from datetime import date, datetime, timedelta
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
from security import get_current_user

router = APIRouter(
    prefix="/caja",
    tags=["Caja"],
    dependencies=[Depends(get_current_user)],
)


def _obtener_inicio_periodo(db: Session, dia: date) -> datetime:
    """
    Devuelve el inicio del periodo actual:
    - Si hay cierres hoy, desde el último cierre
    - Si no, desde medianoche
    """
    inicio_dia = datetime.combine(dia, datetime.min.time())
    fin_dia = inicio_dia + timedelta(days=1)

    ultimo_cierre = (
        db.query(models.CierreCaja)
        .filter(
            models.CierreCaja.fecha_cierre >= inicio_dia,
            models.CierreCaja.fecha_cierre < fin_dia,
        )
        .order_by(models.CierreCaja.fecha_cierre.desc())
        .first()
    )

    if ultimo_cierre:
        return ultimo_cierre.fecha_cierre
    return inicio_dia


def _calcular_resumen(db: Session, desde: datetime, hasta: datetime) -> schemas.ResumenCaja:
    ventas = db.query(models.Venta).filter(
        models.Venta.fecha >= desde,
        models.Venta.fecha < hasta,
    ).all()

    total_dia = sum(v.total for v in ventas)
    total_efectivo = sum(v.total for v in ventas if v.metodo_pago == "efectivo")
    total_sinpe = sum(v.total for v in ventas if v.metodo_pago == "sinpe")
    total_tarjeta = sum(v.total for v in ventas if v.metodo_pago == "tarjeta")

    return schemas.ResumenCaja(
        total_dia=round(total_dia, 2),
        cantidad_ventas=len(ventas),
        total_efectivo=round(total_efectivo, 2),
        total_sinpe=round(total_sinpe, 2),
        total_tarjeta=round(total_tarjeta, 2),
    )


@router.get("/resumen-hoy", response_model=schemas.ResumenCaja)
def resumen_hoy(db: Session = Depends(get_db)):
    """Resumen desde el último cierre (o desde medianoche si no hay cierre hoy)."""
    hoy = date.today()
    desde = _obtener_inicio_periodo(db, hoy)
    hasta = datetime.combine(hoy, datetime.min.time()) + timedelta(days=1)
    return _calcular_resumen(db, desde, hasta)


@router.get("/resumen/{fecha}", response_model=schemas.ResumenCaja)
def resumen_fecha(fecha: date, db: Session = Depends(get_db)):
    desde = _obtener_inicio_periodo(db, fecha)
    hasta = datetime.combine(fecha, datetime.min.time()) + timedelta(days=1)
    return _calcular_resumen(db, desde, hasta)


@router.post("/cerrar", response_model=schemas.CierreCajaOut, status_code=201)
def cerrar_caja(
    cierre: schemas.CierreCajaCreate,
    db: Session = Depends(get_db)
):
    hoy = date.today()
    desde = _obtener_inicio_periodo(db, hoy)
    hasta = datetime.combine(hoy, datetime.min.time()) + timedelta(days=1)
    resumen = _calcular_resumen(db, desde, hasta)

    if resumen.cantidad_ventas == 0:
        raise HTTPException(status_code=400, detail="No hay ventas para cerrar")

    total_esperado = resumen.total_efectivo
    diferencia = round(cierre.total_real - total_esperado, 2)

    db_cierre = models.CierreCaja(
        total_esperado=total_esperado,
        total_real=cierre.total_real,
        diferencia=diferencia,
        total_efectivo=resumen.total_efectivo,
        total_sinpe=resumen.total_sinpe,
        total_tarjeta=resumen.total_tarjeta,
        cantidad_ventas=resumen.cantidad_ventas,
        notas=cierre.notas,
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


@router.delete("/cierres/{cierre_id}", status_code=204)
def eliminar_cierre(cierre_id: int, db: Session = Depends(get_db)):
    """Eliminar un cierre de caja."""
    cierre = db.query(models.CierreCaja).filter(
        models.CierreCaja.id == cierre_id
    ).first()
    if not cierre:
        raise HTTPException(status_code=404, detail="Cierre no encontrado")
    db.delete(cierre)
    db.commit()
