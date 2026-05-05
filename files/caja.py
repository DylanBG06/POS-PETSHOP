"""
Endpoints de caja: resumen del día y cierre de caja.
"""
from datetime import date, datetime, timedelta
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
import models
import schemas

router = APIRouter(prefix="/caja", tags=["Caja"])


def _calcular_resumen_dia(db: Session, dia: date) -> schemas.ResumenCaja:
    """Calcula los totales acumulados del día."""
    inicio = datetime.combine(dia, datetime.min.time())
    fin = inicio + timedelta(days=1)

    ventas = db.query(models.Venta).filter(
        models.Venta.fecha >= inicio,
        models.Venta.fecha < fin,
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
    """Resumen acumulado de ventas del día de hoy, desglosado por método de pago."""
    return _calcular_resumen_dia(db, date.today())


@router.get("/resumen/{fecha}", response_model=schemas.ResumenCaja)
def resumen_fecha(fecha: date, db: Session = Depends(get_db)):
    """Resumen acumulado de un día específico."""
    return _calcular_resumen_dia(db, fecha)


@router.post("/cerrar", response_model=schemas.CierreCajaOut, status_code=201)
def cerrar_caja(
    cierre: schemas.CierreCajaCreate,
    db: Session = Depends(get_db)
):
    """
    Cierra la caja del día actual comparando dinero esperado vs real.
    Solo considera el efectivo para la diferencia, ya que SINPE y tarjeta
    no implican dinero físico en caja.
    """
    resumen = _calcular_resumen_dia(db, date.today())

    # El esperado en caja física es el efectivo del día
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
    """Historial de cierres de caja, más recientes primero."""
    return (
        db.query(models.CierreCaja)
        .order_by(models.CierreCaja.fecha_cierre.desc())
        .limit(limit)
        .all()
    )
