"""
Seguridad: JWT y password hashing.

NOTA IMPORTANTE: SECRET_KEY debería estar en una variable de entorno en producción.
Como este es un sistema local, se genera y guarda en un archivo .secret_key la primera vez.
"""
import os
import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from database import get_db
import models


# Token vence en 12 horas (suficiente para una jornada laboral)
ACCESS_TOKEN_EXPIRE_HOURS = 12
ALGORITHM = "HS256"

SECRET_KEY_FILE = ".secret_key"


def get_or_create_secret_key() -> str:
    """Genera o lee la clave secreta. Se guarda en archivo local."""
    if os.path.exists(SECRET_KEY_FILE):
        with open(SECRET_KEY_FILE, "r") as f:
            return f.read().strip()

    key = secrets.token_urlsafe(64)
    with open(SECRET_KEY_FILE, "w") as f:
        f.write(key)
    print(f"[seguridad] Nueva clave secreta generada en {SECRET_KEY_FILE}")
    print("[seguridad] NO COMPARTAS este archivo. Está en .gitignore.")
    return key


SECRET_KEY = get_or_create_secret_key()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> models.Usuario:
    """Dependencia que valida el token y devuelve el usuario actual."""
    creds_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No autenticado",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not token:
        raise creds_exception

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if not username:
            raise creds_exception
    except JWTError:
        raise creds_exception

    usuario = db.query(models.Usuario).filter(
        models.Usuario.username == username,
        models.Usuario.activo == True,
    ).first()
    if not usuario:
        raise creds_exception
    return usuario


def crear_usuario_admin_si_no_existe(db: Session):
    """
    Crea el usuario admin por defecto si no existe ninguno.
    Username: admin, Password: admin123
    """
    if db.query(models.Usuario).count() == 0:
        admin = models.Usuario(
            username="admin",
            password_hash=hash_password("admin123"),
            nombre_completo="Administrador",
            is_admin=True,
            activo=True,
        )
        db.add(admin)
        db.commit()
        print("=" * 60)
        print("[seguridad] Usuario admin creado por defecto")
        print("[seguridad] Usuario: admin")
        print("[seguridad] Contraseña: admin123")
        print("[seguridad] CAMBIA LA CONTRASEÑA en el primer login")
        print("=" * 60)
