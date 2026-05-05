"""
Sistema POS - Tienda de alimentos para animales
================================================

API REST construida con FastAPI + SQLite.

Para correr:
    uvicorn main:app --reload --port 8000

Documentación interactiva en:
    http://localhost:8000/docs
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, SessionLocal
import models
from routes import (
    productos,
    categorias,
    ventas,
    compras,
    caja,
    reportes,
    configuracion,
)


def crear_datos_iniciales():
    """
    Crea datos por defecto la primera vez que se inicia el sistema:
    - Categorías básicas
    - Configuración inicial del negocio
    """
    db = SessionLocal()
    try:
        # Categorías iniciales si no existen
        if db.query(models.Categoria).count() == 0:
            categorias_default = [
                "Alimentos",
                "Snacks",
                "Accesorios",
                "Higiene",
                "Juguetes",
                "Medicamentos",
            ]
            for nombre in categorias_default:
                db.add(models.Categoria(nombre=nombre))
            db.commit()

        # Configuración inicial
        configs_default = {
            "nombre_negocio": "Mi Tienda de Mascotas",
            "moneda": "CRC",
            "simbolo_moneda": "₡",
        }
        for clave, valor in configs_default.items():
            existente = db.query(models.Configuracion).filter(
                models.Configuracion.clave == clave
            ).first()
            if not existente:
                db.add(models.Configuracion(clave=clave, valor=valor))
        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: crear tablas y datos iniciales
    models.Base.metadata.create_all(bind=engine)
    crear_datos_iniciales()
    yield
    # Shutdown: nada por ahora


app = FastAPI(
    title="POS - Tienda de Mascotas",
    description="Sistema de punto de venta local para tienda de alimentos para animales",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS abierto: el frontend correrá en la misma máquina
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Registrar rutas
app.include_router(productos.router)
app.include_router(categorias.router)
app.include_router(ventas.router)
app.include_router(compras.router)
app.include_router(caja.router)
app.include_router(reportes.router)
app.include_router(configuracion.router)


@app.get("/")
def root():
    return {
        "mensaje": "API del POS funcionando correctamente",
        "documentacion": "/docs",
        "version": "1.0.0",
    }


@app.get("/health")
def health_check():
    return {"status": "ok"}
