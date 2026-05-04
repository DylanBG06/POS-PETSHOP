"""
Endpoints de categorías.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
from security import get_current_user

router = APIRouter(
    prefix="/categorias",
    tags=["Categorias"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/", response_model=List[schemas.CategoriaOut])
def listar_categorias(db: Session = Depends(get_db)):
    return db.query(models.Categoria).order_by(models.Categoria.nombre).all()


@router.post("/", response_model=schemas.CategoriaOut, status_code=201)
def crear_categoria(
    categoria: schemas.CategoriaCreate,
    db: Session = Depends(get_db)
):
    existente = db.query(models.Categoria).filter(
        models.Categoria.nombre == categoria.nombre
    ).first()
    if existente:
        raise HTTPException(
            status_code=400,
            detail=f"La categoría '{categoria.nombre}' ya existe"
        )

    db_categoria = models.Categoria(**categoria.model_dump())
    db.add(db_categoria)
    db.commit()
    db.refresh(db_categoria)
    return db_categoria


@router.put("/{categoria_id}", response_model=schemas.CategoriaOut)
def actualizar_categoria(
    categoria_id: int,
    categoria: schemas.CategoriaCreate,
    db: Session = Depends(get_db)
):
    db_categoria = db.query(models.Categoria).filter(
        models.Categoria.id == categoria_id
    ).first()
    if not db_categoria:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")

    db_categoria.nombre = categoria.nombre
    db.commit()
    db.refresh(db_categoria)
    return db_categoria


@router.delete("/{categoria_id}", status_code=204)
def eliminar_categoria(categoria_id: int, db: Session = Depends(get_db)):
    db_categoria = db.query(models.Categoria).filter(
        models.Categoria.id == categoria_id
    ).first()
    if not db_categoria:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")

    productos_count = db.query(models.Producto).filter(
        models.Producto.categoria_id == categoria_id
    ).count()
    if productos_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede eliminar: tiene {productos_count} productos asociados"
        )

    db.delete(db_categoria)
    db.commit()
