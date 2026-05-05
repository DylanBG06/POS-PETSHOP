"""
Script de migración para actualizar la base de datos.
Ejecutar: python migrar.py
"""
import sqlite3
import os


DB_PATH = "pos.db"


def column_exists(cursor, table, column):
    cursor.execute(f"PRAGMA table_info({table})")
    return column in [row[1] for row in cursor.fetchall()]


def table_exists(cursor, table):
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
    return cursor.fetchone() is not None


def main():
    if not os.path.exists(DB_PATH):
        print(f"[migrar] No existe {DB_PATH}. Se creará al iniciar el servidor.")
        return

    print(f"[migrar] Abriendo {DB_PATH}...")
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cambios = []

    if table_exists(cur, "productos"):
        if not column_exists(cur, "productos", "tipo_venta"):
            cur.execute("ALTER TABLE productos ADD COLUMN tipo_venta VARCHAR(10) NOT NULL DEFAULT 'unidad'")
            cambios.append("productos.tipo_venta")
        if not column_exists(cur, "productos", "unidad_medida"):
            cur.execute("ALTER TABLE productos ADD COLUMN unidad_medida VARCHAR(5)")
            cambios.append("productos.unidad_medida")
        if not column_exists(cur, "productos", "tipo_producto"):
            cur.execute("ALTER TABLE productos ADD COLUMN tipo_producto VARCHAR(20) NOT NULL DEFAULT 'COMPRABLE'")
            cambios.append("productos.tipo_producto")
        if not column_exists(cur, "productos", "id_padre"):
            cur.execute("ALTER TABLE productos ADD COLUMN id_padre INTEGER")
            cambios.append("productos.id_padre")
        if not column_exists(cur, "productos", "factor_conversion"):
            cur.execute("ALTER TABLE productos ADD COLUMN factor_conversion FLOAT")
            cambios.append("productos.factor_conversion")

    if table_exists(cur, "detalle_venta"):
        if not column_exists(cur, "detalle_venta", "costo_unit"):
            cur.execute("ALTER TABLE detalle_venta ADD COLUMN costo_unit FLOAT NOT NULL DEFAULT 0")
            cambios.append("detalle_venta.costo_unit")

    if table_exists(cur, "ventas"):
        if not column_exists(cur, "ventas", "usuario_id"):
            cur.execute("ALTER TABLE ventas ADD COLUMN usuario_id INTEGER")
            cambios.append("ventas.usuario_id")

    conn.commit()
    conn.close()

    if cambios:
        print(f"[migrar] OK. Cambios: {len(cambios)}")
        for c in cambios:
            print(f"  + {c}")
    else:
        print("[migrar] Todo en orden, no hay cambios pendientes.")


if __name__ == "__main__":
    main()
