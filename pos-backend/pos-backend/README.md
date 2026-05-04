# Mascotitas Felices POS — Sistema v2

Sistema de punto de venta local para tienda de alimentos para animales.

## Novedades de la v2

- **Login con usuario y contraseña** — protege el acceso al sistema
- **Productos por peso** — vendé sacos completos o por kg/g
- **Sistema de ganancias** — ganancia bruta, compras, flujo neto, mensual y por día
- **Costo histórico congelado** — los reportes de ganancia son siempre correctos aunque cambies costos
- **Despliegue fácil** con Git + scripts de Windows

---

## 📦 Estructura del proyecto

```
POS PETSHOP/
├── pos-backend/        ← Servidor (Python + FastAPI)
│   ├── instalar.bat    ← Instalación inicial (1 sola vez)
│   ├── iniciar.bat     ← Arrancar el servidor (cada día)
│   ├── actualizar.bat  ← Bajar nuevos cambios desde Git
│   ├── migrar.py       ← Actualiza la BD a nuevo esquema
│   └── pos.db          ← Base de datos (NO subir a Git)
│
└── pos-frontend/       ← Interfaz (React)
    ├── iniciar.bat
    └── actualizar.bat
```

---

## 🚀 Pasos para actualizar de v1 a v2 en tu laptop actual

Si ya tenés el v1 corriendo, seguí estos pasos:

### 1. Hacer backup de tu BD actual

Copiá `pos.db` (que está dentro de `pos-backend`) a algún lugar seguro. Por las dudas.

### 2. Reemplazar archivos

Copiá **todos los archivos del backend v2** sobre los del v1:
- `database.py`, `models.py`, `schemas.py`, `security.py` (nuevo), `main.py`, `migrar.py` (nuevo)
- `requirements.txt`
- Toda la carpeta `routes/`
- `.gitignore`
- Los `.bat`

**No borres** la carpeta `venv/` ni `pos.db`.

### 3. Instalar dependencias nuevas

Abrí una terminal en la carpeta del backend y ejecutá:

```bash
venv\Scripts\activate
pip install -r requirements.txt
```

Esto instala `python-jose`, `passlib`, `bcrypt` (necesarios para login).

### 4. Migrar la base de datos

```bash
python migrar.py
```

Esto agrega los campos nuevos (`tipo_venta`, `costo_unit`, etc.) sin borrar tus datos.

> ⚠️ Las ventas anteriores quedarán con ganancia histórica = 0 porque no había costo guardado. Las ventas nuevas calculan bien.

### 5. Iniciar el servidor

```bash
uvicorn main:app --reload --port 8000
```

O hacé doble clic en `iniciar.bat`.

La primera vez que arranca te crea el usuario admin por defecto. Lo verás en la consola:

```
[seguridad] Usuario admin creado por defecto
[seguridad] Usuario: admin
[seguridad] Contraseña: admin123
```

### 6. Instalar el frontend

En otra carpeta (al mismo nivel que `pos-backend`):

```bash
cd pos-frontend
npm install
npm run dev
```

Abrí http://localhost:5173 en el navegador y entrá con `admin` / `admin123`.

### 7. ⚠️ CAMBIAR LA CONTRASEÑA

En cuanto entres, andá a **Configuración → Mi cuenta** y cambiá la contraseña por una segura.

---

## 💾 Cómo desplegar en la laptop del negocio

### Opción A: Git + GitHub privado (recomendada)

#### En tu laptop de desarrollo (1 sola vez):

1. **Crear cuenta en GitHub** si no tenés: https://github.com/signup
2. **Crear repositorio privado** en https://github.com/new
   - Nombre: `pos-mascotitas`
   - Visibilidad: **Privado** (importante)
   - No marques nada más
3. En la carpeta del proyecto, abrí terminal y subí:

```bash
cd "POS PETSHOP"
git init
git add .
git commit -m "Versión inicial"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/pos-mascotitas.git
git push -u origin main
```

> Te va a pedir login. Si te da problemas, configurá un Personal Access Token: https://github.com/settings/tokens

#### En la laptop del negocio (1 sola vez):

1. **Instalar Python 3.11+** (https://www.python.org/downloads/)
2. **Instalar Node.js LTS** (https://nodejs.org/)
3. **Instalar Git** (https://git-scm.com/download/win)
4. Clonar el repo:

```bash
cd C:\
git clone https://github.com/TU-USUARIO/pos-mascotitas.git
cd pos-mascotitas
```

5. Instalar y arrancar:

```bash
cd pos-backend
instalar.bat
iniciar.bat
```

En otra ventana:

```bash
cd ..\pos-frontend
iniciar.bat
```

#### Cuando hagas cambios desde tu laptop:

```bash
git add .
git commit -m "Descripción del cambio"
git push
```

#### En la laptop del negocio, para actualizar:

Doble clic en `actualizar.bat` (en `pos-backend` y luego en `pos-frontend`).

---

## 🎯 Sistema de productos por peso

### Cuando creás un producto nuevo, elegís entre:

**Por unidad** — para collares, latas, juguetes (cantidades enteras)

**Por peso** — para sacos de alimento, snacks a granel
- Elegís unidad: `kg` o `g`
- El **precio** y **costo** se ingresan **por unidad de medida** (precio por kg)
- El **stock** puede ser decimal (28.5 kg)

### En ventas:

- Productos por unidad → click directo, suma 1
- Productos por peso → aparece un **modal "Pesar"** donde ingresás la cantidad exacta
- Podés mezclar ambos en la misma venta

### Ejemplo real:

```
Producto: Dog Chow Adulto
  Tipo: peso
  Unidad: kg
  Precio: ₡4.500/kg
  Costo: ₡2.800/kg
  Stock: 30 kg
```

Cliente lleva 1.5 kg → total línea = ₡6.750, stock baja a 28.5 kg, ganancia = ₡2.550

---

## 📊 Sistema de ganancias

En **Reportes** ahora hay dos tabs:

**Ventas** — el reporte tradicional (sin "ticket promedio" como pediste)

**Ganancias** — métricas financieras:
- **Ganancia bruta** — `Σ (precio - costo) × cantidad`
- **Compras** — total gastado en proveedores
- **Flujo neto** — `ganancia bruta - compras`

> **Nota importante**: el flujo neto es **flujo de caja**, no utilidad contable real. Si compraste mucho stock que aún no vendiste, puede ser negativo aunque el negocio esté sano.

Vista mensual: gráfico de los 12 meses del año + tabla resumen.

---

## 🔐 Seguridad

- El sistema NO arranca sin login
- Token JWT vence en 12 horas (suficiente para una jornada)
- Si te roban la laptop, los datos están en `pos.db` — hacé backup periódico
- El archivo `.secret_key` se genera por máquina y NO se sube a Git

---

## 🆘 Problemas comunes

**"No encuentra el usuario admin"** → Ejecutá `python migrar.py` y reiniciá el servidor.

**"Contraseña inválida después de migrar"** → Borrá la BD y empezá de cero, o resetea el usuario admin manualmente con SQLite.

**"El frontend no conecta con el backend"** → Asegurate de que el backend está corriendo en `localhost:8000` antes de abrir el frontend.

**"No me deja cambiar el tipo de venta de un producto"** → Es a propósito. Si ya hay ventas con ese producto, no se puede cambiar para no romper el histórico. Creá uno nuevo si lo necesitás.

---

## 📞 Backup de datos

El archivo `pos.db` contiene **todos** los datos. Hacé copia periódica:

```bash
copy pos.db backups\pos_backup_2026-01-15.db
```

`actualizar.bat` ya hace backup automático antes de cualquier cambio.
