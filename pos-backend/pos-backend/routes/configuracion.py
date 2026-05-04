"""
Endpoints de configuración.
"""
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
from security import get_current_user

router = APIRouter(
    prefix="/configuracion",
    tags=["Configuracion"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/", response_model=List[schemas.ConfiguracionOut])
def listar_configuracion(db: Session = Depends(get_db)):
    return db.query(models.Configuracion).all()


@router.get("/{clave}")
def obtener_valor(clave: str, db: Session = Depends(get_db)):
    config = db.query(models.Configuracion).filter(
        models.Configuracion.clave == clave
    ).first()
    if not config:
        return {"clave": clave, "valor": None}
    return {"clave": config.clave, "valor": config.valor}


@router.put("/", response_model=schemas.ConfiguracionOut)
def actualizar_configuracion(
    item: schemas.ConfiguracionItem,
    db: Session = Depends(get_db)
):
    config = db.query(models.Configuracion).filter(
        models.Configuracion.clave == item.clave
    ).first()

    if config:
        config.valor = item.valor
    else:
        config = models.Configuracion(clave=item.clave, valor=item.valor)
        db.add(config)

    db.commit()
    db.refresh(config)
    return config
