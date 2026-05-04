"""
Endpoints de autenticación.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
import models
import schemas
from security import (
    create_access_token,
    verify_password,
    hash_password,
    get_current_user,
)

router = APIRouter(prefix="/auth", tags=["Autenticacion"])


@router.post("/login", response_model=schemas.TokenResponse)
def login(credenciales: schemas.LoginRequest, db: Session = Depends(get_db)):
    """Login con username y password. Devuelve un JWT."""
    usuario = db.query(models.Usuario).filter(
        models.Usuario.username == credenciales.username,
        models.Usuario.activo == True,
    ).first()

    if not usuario or not verify_password(credenciales.password, usuario.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
        )

    token = create_access_token({"sub": usuario.username})
    return schemas.TokenResponse(
        access_token=token,
        token_type="bearer",
        usuario=schemas.UsuarioOut.model_validate(usuario),
    )


@router.get("/yo", response_model=schemas.UsuarioOut)
def usuario_actual(usuario: models.Usuario = Depends(get_current_user)):
    """Devuelve los datos del usuario autenticado."""
    return usuario


@router.post("/cambiar-password")
def cambiar_password(
    datos: schemas.CambiarPasswordRequest,
    usuario: models.Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cambiar la propia contraseña."""
    if not verify_password(datos.password_actual, usuario.password_hash):
        raise HTTPException(
            status_code=400,
            detail="La contraseña actual es incorrecta",
        )

    usuario.password_hash = hash_password(datos.password_nueva)
    db.commit()
    return {"mensaje": "Contraseña actualizada correctamente"}
