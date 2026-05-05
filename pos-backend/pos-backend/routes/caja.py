"""
Endpoints de caja: apertura, resumen y cierre.

Flujo correcto:
  1. Al inicio del turno: registrar APERTURA con el dinero en caja
  2. Durante el día: ventas se acumulan
  3. Al cierre: esperado = apertura + ventas_efectivo
                diferencia = real_contado - esperado
"""
from datetime import date, datetime, timedelta
from typing import List, Optional
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


def _inicio_periodo(db: Session, dia: date) -> datetime:
    """Devuelve desde cuándo contar ventas (desde último cierre, o medianoche)."""
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
    return ultimo_cierre.fecha_cierre if ultimo_cierre else inicio_dia


def _apertura_actual(db: Session, dia: date) -> Optional[models.AperturaCaja]:
    """Busca la apertura del turno actual (después del último cierre)."""
    desde = _inicio_periodo(db, dia)
    fin_dia = datetime.combine(dia, datetime.min.time()) + timedelta(days=1)

    return (
        db.query(models.AperturaCaja)
        .filter(
            models.AperturaCaja.fecha >= desde,
            models.AperturaCaja.fecha < fin_dia,
        )
        .order_by(models.AperturaCaja.fecha.desc())
        .first()
    )


def _calcular_resumen(db: Session, desde: datetime, hasta: datetime, apertura: Optional[models.AperturaCaja]) -> schemas.ResumenCaja:
    ventas = db.query(models.Venta).filter(
        models.Venta.fecha >= desde,
        models.Venta.fecha < hasta,
    ).all()

    total_dia = sum(v.total for v in ventas)
    total_efectivo = sum(v.total for v in ventas if v.metodo_pago == "efectivo")
    total_sinpe = sum(v.total for v in ventas if v.metodo_pago == "sinpe")
    total_tarjeta = sum(v.total for v in ventas if v.metodo_pago == "tarjeta")

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
    )


# ─── APERTURA ────────────────────────────────────────────────

@router.post("/apertura", response_model=schemas.AperturaCajaOut, status_code=201)
def registrar_apertura(apertura: schemas.AperturaCajaCreate, db: Session = Depends(get_db)):
    """Registrar con cuánto dinero inicia la caja."""
    hoy = date.today()

    # No permitir doble apertura en el mismo turno
    if _apertura_actual(db, hoy):
        raise HTTPException(
            status_code=400,
            detail="Ya hay una apertura registrada para este turno. Hacé cierre primero para abrir un turno nuevo."
        )

    db_apertura = models.AperturaCaja(
        monto=apertura.monto,
        notas=apertura.notas,
    )
    db.add(db_apertura)
    db.commit()
    db.refresh(db_apertura)
    return db_apertura


@router.get("/apertura-hoy", response_model=Optional[schemas.AperturaCajaOut])
def apertura_hoy(db: Session = Depends(get_db)):
    """Devuelve la apertura del turno actual, o null si no hay."""
    return _apertura_actual(db, date.today())


# ─── RESUMEN ─────────────────────────────────────────────────

@router.get("/resumen-hoy", response_model=schemas.ResumenCaja)
def resumen_hoy(db: Session = Depends(get_db)):
    hoy = date.today()
    desde = _inicio_periodo(db, hoy)
    hasta = datetime.combine(hoy, datetime.min.time()) + timedelta(days=1)
    apertura = _apertura_actual(db, hoy)
    return _calcular_resumen(db, desde, hasta, apertura)


# ─── CIERRE ──────────────────────────────────────────────────

@router.post("/cerrar", response_model=schemas.CierreCajaOut, status_code=201)
def cerrar_caja(cierre: schemas.CierreCajaCreate, db: Session = Depends(get_db)):
    hoy = date.today()
    desde = _inicio_periodo(db, hoy)
    hasta = datetime.combine(hoy, datetime.min.time()) + timedelta(days=1)
    apertura = _apertura_actual(db, hoy)
    resumen = _calcular_resumen(db, desde, hasta, apertura)

    if resumen.cantidad_ventas == 0:
        raise HTTPException(status_code=400, detail="No hay ventas para cerrar")

    monto_apertura = apertura.monto if apertura else 0
    total_esperado = round(monto_apertura + resumen.total_efectivo, 2)
    diferencia = round(cierre.total_real - total_esperado, 2)

    db_cierre = models.CierreCaja(
        monto_apertura=monto_apertura,
        total_ventas_efectivo=resumen.total_efectivo,
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


# ─── LISTADOS ────────────────────────────────────────────────

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
    cierre = db.query(models.CierreCaja).filter(models.CierreCaja.id == cierre_id).first()
    if not cierre:
        raise HTTPException(status_code=404, detail="Cierre no encontrado")
    db.delete(cierre)
    db.commit()
