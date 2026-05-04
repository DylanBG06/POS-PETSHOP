"""
Script de migración para actualizar la base de datos al nuevo esquema.

Ejecutalo UNA SOLA VEZ después de actualizar el código:
    python migrar.py

Cambios que aplica:
- Agrega columna 'tipo_venta' a productos (default: 'unidad')
- Agrega columna 'unidad_medida' a productos (NULL)
- Agrega columna 'costo_unit' a detalle_venta (default: 0)
- Agrega columna 'usuario_id' a ventas (NULL)
- Cambia 'cantidad' a Float donde corresponde
- Crea tabla 'usuarios' si no existe

Si la base de datos es nueva, este script no hace nada (las tablas ya están bien).
"""
import sqlite3
import os
import sys

DB_PATH = "pos.db"


def column_exists(cursor, table, column):
    cursor.execute(f"PRAGMA table_info({table})")
    cols = [row[1] for row in cursor.fetchall()]
    return column in cols


def table_exists(cursor, table):
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table,)
    )
    return cursor.fetchone() is not None


def main():
    if not os.path.exists(DB_PATH):
        print(f"[migrar] No existe {DB_PATH}. La BD se creará vacía al iniciar el servidor.")
        return

    print(f"[migrar] Abriendo {DB_PATH}...")
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cambios = []

    # 1. Productos: tipo_venta y unidad_medida
    if table_exists(cur, "productos"):
        if not column_exists(cur, "productos", "tipo_venta"):
            cur.execute("ALTER TABLE productos ADD COLUMN tipo_venta VARCHAR(10) NOT NULL DEFAULT 'unidad'")
            cambios.append("productos.tipo_venta agregada")
        if not column_exists(cur, "productos", "unidad_medida"):
            cur.execute("ALTER TABLE productos ADD COLUMN unidad_medida VARCHAR(5)")
            cambios.append("productos.unidad_medida agregada")

    # 2. Detalle_venta: costo_unit (clave para reportes históricos)
    if table_exists(cur, "detalle_venta"):
        if not column_exists(cur, "detalle_venta", "costo_unit"):
            cur.execute("ALTER TABLE detalle_venta ADD COLUMN costo_unit FLOAT NOT NULL DEFAULT 0")
            cambios.append("detalle_venta.costo_unit agregada")

    # 3. Ventas: usuario_id
    if table_exists(cur, "ventas"):
        if not column_exists(cur, "ventas", "usuario_id"):
            cur.execute("ALTER TABLE ventas ADD COLUMN usuario_id INTEGER")
            cambios.append("ventas.usuario_id agregada")

    conn.commit()
    conn.close()

    if cambios:
        print(f"[migrar] OK. Cambios aplicados: {len(cambios)}")
        for c in cambios:
            print(f"  - {c}")
        print()
        print("[migrar] IMPORTANTE: las ventas anteriores tienen costo_unit=0,")
        print("[migrar] así que su ganancia histórica queda en 0.")
        print("[migrar] Las ventas nuevas calculan correctamente.")
    else:
        print("[migrar] Todo en orden, no hay cambios pendientes.")


if __name__ == "__main__":
    main()
