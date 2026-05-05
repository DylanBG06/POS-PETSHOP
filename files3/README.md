# POS - Tienda de Alimentos para Animales

Backend del sistema de punto de venta. API REST construida con FastAPI + SQLite.

## Características

- Base de datos local en un solo archivo (`pos.db`) - cero configuración
- API REST documentada automáticamente
- Transacciones atómicas en ventas (si algo falla, no se guarda nada)
- Cálculo automático de stock, totales y vuelto
- Reportes con datos listos para gráficos
- Alertas de stock bajo y productos por vencer

## Instalación

### 1. Requisitos previos

- Python 3.10 o superior

### 2. Crear entorno virtual (recomendado)

**Windows:**
```bash
python -m venv venv
venv\Scripts\activate
```

**Mac / Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Instalar dependencias

```bash
pip install -r requirements.txt
```

### 4. Correr el servidor

```bash
uvicorn main:app --reload --port 8000
```

La primera vez que arranca, crea automáticamente:
- El archivo `pos.db` con todas las tablas
- Categorías por defecto (Alimentos, Snacks, Accesorios, Higiene, Juguetes, Medicamentos)
- Configuración inicial del negocio (moneda en colones)

## Endpoints disponibles

Una vez corriendo, abrí en el navegador:

- **Documentación interactiva (Swagger):** http://localhost:8000/docs
- **Documentación alternativa (ReDoc):** http://localhost:8000/redoc

### Resumen de rutas

| Módulo | Ruta base | Funciones principales |
|--------|-----------|----------------------|
| Productos | `/productos` | CRUD, búsqueda rápida, alertas |
| Categorías | `/categorias` | CRUD básico |
| Ventas | `/ventas` | Registrar venta, consultar histórico |
| Compras | `/compras` | Registrar reposición, consultar histórico |
| Caja | `/caja` | Resumen del día, cierre de caja |
| Reportes | `/reportes` | Por rango de fechas, productos top, datos para gráficos |
| Configuración | `/configuracion` | Nombre del negocio, moneda |

## Estructura del proyecto

```
pos-backend/
├── main.py              # Entry point de la API
├── database.py          # Conexión SQLite + SQLAlchemy
├── models.py            # Tablas de la BD
├── schemas.py           # Validación Pydantic
├── requirements.txt     # Dependencias
├── pos.db               # BD SQLite (se crea al iniciar)
└── routes/
    ├── productos.py
    ├── categorias.py
    ├── ventas.py
    ├── compras.py
    ├── caja.py
    ├── reportes.py
    └── configuracion.py
```

## Ejemplo de uso

### Crear un producto

```bash
POST http://localhost:8000/productos/
Content-Type: application/json

{
  "codigo": "ALM001",
  "nombre": "Dog Chow Adulto 4kg",
  "precio_venta": 8500,
  "costo": 6500,
  "stock": 20,
  "stock_minimo": 5,
  "categoria_id": 1,
  "fecha_vencimiento": "2026-12-31"
}
```

### Registrar una venta

```bash
POST http://localhost:8000/ventas/
Content-Type: application/json

{
  "metodo_pago": "efectivo",
  "monto_recibido": 10000,
  "detalles": [
    { "producto_id": 1, "cantidad": 1 }
  ]
}
```

La respuesta incluye el vuelto calculado automáticamente y descuenta el stock.

### Resumen de caja del día

```bash
GET http://localhost:8000/caja/resumen-hoy
```

Devuelve total del día, cantidad de ventas y desglose por método de pago.

## Backup de la base de datos

Como SQLite guarda todo en un solo archivo, hacer backup es tan simple como copiar `pos.db` a otra ubicación. Recomendado: hacerlo automáticamente cada vez que se cierra caja.

## Próximos pasos

- Conectar el frontend (React + Vite + Tailwind)
- Empaquetar como ejecutable de escritorio con PyInstaller o Electron
- Agregar respaldo automático nocturno
