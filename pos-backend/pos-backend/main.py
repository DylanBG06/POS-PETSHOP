"""
Sistema POS - Tienda de alimentos para animales (v2)
=====================================================

Cambios v2:
- Login con JWT (usuario admin por defecto: admin/admin123)
- Productos con tipo_venta ('unidad' o 'peso')
- Costo congelado en cada venta (reportes históricos correctos)
- Sistema completo de ganancias

Para correr:
    uvicorn main:app --reload --port 8000

Documentación interactiva:
    http://localhost:8000/docs
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, SessionLocal
import models
from routes import (
    auth,
    productos,
    categorias,
    ventas,
    compras,
    ingresos,
    caja,
    reportes,
    configuracion,
)
from security import crear_usuario_admin_si_no_existe


def crear_datos_iniciales():
    db = SessionLocal()
    try:
        # Categorías iniciales
        if db.query(models.Categoria).count() == 0:
            for nombre in ["Alimentos", "Snacks", "Accesorios", "Higiene", "Juguetes", "Medicamentos"]:
                db.add(models.Categoria(nombre=nombre))
            db.commit()

        # Configuración inicial
        configs = {
            "nombre_negocio": "Mi Tienda de Mascotas",
            "moneda": "CRC",
            "simbolo_moneda": "₡",
        }
        for clave, valor in configs.items():
            existente = db.query(models.Configuracion).filter(
                models.Configuracion.clave == clave
            ).first()
            if not existente:
                db.add(models.Configuracion(clave=clave, valor=valor))
        db.commit()

        # Usuario admin por defecto
        crear_usuario_admin_si_no_existe(db)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    models.Base.metadata.create_all(bind=engine)
    crear_datos_iniciales()
    yield


app = FastAPI(
    title="POS - Tienda de Mascotas v2",
    description="Sistema POS local con autenticación, ganancias y productos por peso",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rutas
app.include_router(auth.router)
app.include_router(productos.router)
app.include_router(categorias.router)
app.include_router(ventas.router)
app.include_router(compras.router)
app.include_router(ingresos.router)
app.include_router(caja.router)
app.include_router(reportes.router)
app.include_router(configuracion.router)


@app.get("/")
def root():
    return {"mensaje": "POS API v2", "documentacion": "/docs", "version": "2.0.0"}


@app.get("/health")
def health_check():
    return {"status": "ok"}
