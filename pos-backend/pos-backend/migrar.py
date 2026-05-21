"""
Script de migración no destructiva: agrega columnas/tablas faltantes
sin perder datos. Se puede correr múltiples veces.
"""
import os
import sqlite3
import sys

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pos.db")


def table_exists(cur, table_name):
    cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table_name,)
    )
    return cur.fetchone() is not None


def column_exists(cur, table_name, column_name):
    cur.execute(f"PRAGMA table_info({table_name})")
    return any(row[1] == column_name for row in cur.fetchall())


def main():
    if not os.path.exists(DB_PATH):
        print("[migrar] No existe pos.db, no hay nada que migrar.")
        print("[migrar] La base se creará automáticamente al iniciar el sistema.")
        return

    print(f"[migrar] Abriendo {os.path.basename(DB_PATH)}...")
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cambios = []

    # ─── USUARIOS ───
    if table_exists(cur, "usuarios"):
        if not column_exists(cur, "usuarios", "nombre"):
            cur.execute("ALTER TABLE usuarios ADD COLUMN nombre VARCHAR(100)")
            cambios.append("usuarios.nombre")
        if not column_exists(cur, "usuarios", "rol"):
            cur.execute("ALTER TABLE usuarios ADD COLUMN rol VARCHAR(20) NOT NULL DEFAULT 'admin'")
            cambios.append("usuarios.rol")
        if not column_exists(cur, "usuarios", "debe_cambiar_password"):
            cur.execute("ALTER TABLE usuarios ADD COLUMN debe_cambiar_password BOOLEAN NOT NULL DEFAULT 0")
            cambios.append("usuarios.debe_cambiar_password")
        if not column_exists(cur, "usuarios", "activo"):
            cur.execute("ALTER TABLE usuarios ADD COLUMN activo BOOLEAN NOT NULL DEFAULT 1")
            cambios.append("usuarios.activo")
        if not column_exists(cur, "usuarios", "fecha_creacion"):
            cur.execute("ALTER TABLE usuarios ADD COLUMN fecha_creacion DATETIME")
            cambios.append("usuarios.fecha_creacion")

    # ─── USUARIOS ───
    if table_exists(cur, "usuarios"):
        if not column_exists(cur, "usuarios", "nombre"):
            cur.execute("ALTER TABLE usuarios ADD COLUMN nombre VARCHAR(100)")
            cambios.append("usuarios.nombre")
        if not column_exists(cur, "usuarios", "rol"):
            cur.execute("ALTER TABLE usuarios ADD COLUMN rol VARCHAR(20) NOT NULL DEFAULT 'admin'")
            cambios.append("usuarios.rol")
        if not column_exists(cur, "usuarios", "debe_cambiar_password"):
            cur.execute("ALTER TABLE usuarios ADD COLUMN debe_cambiar_password BOOLEAN NOT NULL DEFAULT 0")
            cambios.append("usuarios.debe_cambiar_password")
        if not column_exists(cur, "usuarios", "activo"):
            cur.execute("ALTER TABLE usuarios ADD COLUMN activo BOOLEAN NOT NULL DEFAULT 1")
            cambios.append("usuarios.activo")
        if not column_exists(cur, "usuarios", "fecha_creacion"):
            cur.execute("ALTER TABLE usuarios ADD COLUMN fecha_creacion DATETIME")
            cambios.append("usuarios.fecha_creacion")

    # ─── CATEGORIAS ───
    if table_exists(cur, "categorias"):
        if not column_exists(cur, "categorias", "color"):
            cur.execute("ALTER TABLE categorias ADD COLUMN color VARCHAR(20)")
            cambios.append("categorias.color")

    # ─── PRODUCTOS ───
    if table_exists(cur, "productos"):
        if not column_exists(cur, "productos", "codigo"):
            cur.execute("ALTER TABLE productos ADD COLUMN codigo VARCHAR(50)")
            cambios.append("productos.codigo")
        if not column_exists(cur, "productos", "tipo_venta"):
            cur.execute("ALTER TABLE productos ADD COLUMN tipo_venta VARCHAR(20) NOT NULL DEFAULT 'unidad'")
            cambios.append("productos.tipo_venta")
        if not column_exists(cur, "productos", "unidad_medida"):
            cur.execute("ALTER TABLE productos ADD COLUMN unidad_medida VARCHAR(20)")
            cambios.append("productos.unidad_medida")
        if not column_exists(cur, "productos", "stock_minimo"):
            cur.execute("ALTER TABLE productos ADD COLUMN stock_minimo FLOAT NOT NULL DEFAULT 5")
            cambios.append("productos.stock_minimo")
        if not column_exists(cur, "productos", "categoria_id"):
            cur.execute("ALTER TABLE productos ADD COLUMN categoria_id INTEGER")
            cambios.append("productos.categoria_id")
        if not column_exists(cur, "productos", "fecha_vencimiento"):
            cur.execute("ALTER TABLE productos ADD COLUMN fecha_vencimiento VARCHAR(20)")
            cambios.append("productos.fecha_vencimiento")
        if not column_exists(cur, "productos", "activo"):
            cur.execute("ALTER TABLE productos ADD COLUMN activo BOOLEAN NOT NULL DEFAULT 1")
            cambios.append("productos.activo")
        if not column_exists(cur, "productos", "fecha_creacion"):
            cur.execute("ALTER TABLE productos ADD COLUMN fecha_creacion DATETIME")
            cambios.append("productos.fecha_creacion")
        if not column_exists(cur, "productos", "tipo_producto"):
            cur.execute("ALTER TABLE productos ADD COLUMN tipo_producto VARCHAR(20) NOT NULL DEFAULT 'COMPRABLE'")
            cambios.append("productos.tipo_producto")
        if not column_exists(cur, "productos", "id_padre"):
            cur.execute("ALTER TABLE productos ADD COLUMN id_padre INTEGER")
            cambios.append("productos.id_padre")
        if not column_exists(cur, "productos", "factor_conversion"):
            cur.execute("ALTER TABLE productos ADD COLUMN factor_conversion FLOAT NOT NULL DEFAULT 1")
            cambios.append("productos.factor_conversion")

    # ─── VENTAS ───
    if table_exists(cur, "ventas"):
        if not column_exists(cur, "ventas", "usuario_id"):
            cur.execute("ALTER TABLE ventas ADD COLUMN usuario_id INTEGER")
            cambios.append("ventas.usuario_id")
        if not column_exists(cur, "ventas", "descuento"):
            cur.execute("ALTER TABLE ventas ADD COLUMN descuento FLOAT NOT NULL DEFAULT 0")
            cambios.append("ventas.descuento")
        if not column_exists(cur, "ventas", "monto_regalias"):
            cur.execute("ALTER TABLE ventas ADD COLUMN monto_regalias FLOAT NOT NULL DEFAULT 0")
            cambios.append("ventas.monto_regalias")
        # Pagos divididos
        if not column_exists(cur, "ventas", "monto_efectivo"):
            cur.execute("ALTER TABLE ventas ADD COLUMN monto_efectivo FLOAT NOT NULL DEFAULT 0")
            cambios.append("ventas.monto_efectivo")
        if not column_exists(cur, "ventas", "monto_sinpe"):
            cur.execute("ALTER TABLE ventas ADD COLUMN monto_sinpe FLOAT NOT NULL DEFAULT 0")
            cambios.append("ventas.monto_sinpe")
        if not column_exists(cur, "ventas", "monto_tarjeta"):
            cur.execute("ALTER TABLE ventas ADD COLUMN monto_tarjeta FLOAT NOT NULL DEFAULT 0")
            cambios.append("ventas.monto_tarjeta")

        # Poblar campos divididos a partir del metodo_pago en ventas viejas
        cur.execute("""
            UPDATE ventas SET monto_efectivo = total
            WHERE metodo_pago = 'efectivo'
              AND (monto_efectivo IS NULL OR monto_efectivo = 0)
        """)
        cur.execute("""
            UPDATE ventas SET monto_sinpe = total
            WHERE metodo_pago = 'sinpe'
              AND (monto_sinpe IS NULL OR monto_sinpe = 0)
        """)
        cur.execute("""
            UPDATE ventas SET monto_tarjeta = total
            WHERE metodo_pago = 'tarjeta'
              AND (monto_tarjeta IS NULL OR monto_tarjeta = 0)
        """)

    # ─── DETALLE VENTA ───
    if table_exists(cur, "detalle_venta"):
        if not column_exists(cur, "detalle_venta", "es_regalia"):
            cur.execute("ALTER TABLE detalle_venta ADD COLUMN es_regalia BOOLEAN NOT NULL DEFAULT 0")
            cambios.append("detalle_venta.es_regalia")
        if not column_exists(cur, "detalle_venta", "descuento_item"):
            cur.execute("ALTER TABLE detalle_venta ADD COLUMN descuento_item FLOAT NOT NULL DEFAULT 0")
            cambios.append("detalle_venta.descuento_item")

    # ─── COMPRAS (descontinuado) ───
    if table_exists(cur, "compras"):
        if not column_exists(cur, "compras", "descuento"):
            cur.execute("ALTER TABLE compras ADD COLUMN descuento FLOAT NOT NULL DEFAULT 0")
            cambios.append("compras.descuento")
        if not column_exists(cur, "compras", "iva"):
            cur.execute("ALTER TABLE compras ADD COLUMN iva FLOAT NOT NULL DEFAULT 0")
            cambios.append("compras.iva")

    if table_exists(cur, "detalle_compra"):
        if not column_exists(cur, "detalle_compra", "es_regalia"):
            cur.execute("ALTER TABLE detalle_compra ADD COLUMN es_regalia BOOLEAN NOT NULL DEFAULT 0")
            cambios.append("detalle_compra.es_regalia")

    # ─── CIERRES CAJA ───
    if table_exists(cur, "cierres_caja"):
        if not column_exists(cur, "cierres_caja", "monto_apertura"):
            cur.execute("ALTER TABLE cierres_caja ADD COLUMN monto_apertura FLOAT DEFAULT 0")
            cambios.append("cierres_caja.monto_apertura")
        if not column_exists(cur, "cierres_caja", "total_ventas_efectivo"):
            cur.execute("ALTER TABLE cierres_caja ADD COLUMN total_ventas_efectivo FLOAT DEFAULT 0")
            cambios.append("cierres_caja.total_ventas_efectivo")
        if not column_exists(cur, "cierres_caja", "monto_bonificado"):
            cur.execute("ALTER TABLE cierres_caja ADD COLUMN monto_bonificado FLOAT DEFAULT 0")
            cambios.append("cierres_caja.monto_bonificado")

    # ─── TABLA INGRESOS ───
    if not table_exists(cur, "ingresos"):
        cur.execute("""
            CREATE TABLE ingresos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
                producto_id INTEGER NOT NULL,
                descripcion VARCHAR(200),
                cantidad FLOAT NOT NULL,
                costo_unit FLOAT NOT NULL,
                venta_unit FLOAT NOT NULL,
                FOREIGN KEY (producto_id) REFERENCES productos(id)
            )
        """)
        cur.execute("CREATE INDEX idx_ingresos_fecha ON ingresos(fecha)")
        cambios.append("tabla: ingresos")

    # ─── ELIMINAR COMPRAS VIEJAS ───
    if table_exists(cur, "detalle_compra"):
        cur.execute("SELECT COUNT(*) FROM detalle_compra")
        count_det = cur.fetchone()[0]
        if count_det > 0:
            cur.execute("DELETE FROM detalle_compra")
            cambios.append(f"detalle_compra: {count_det} registros eliminados")

    if table_exists(cur, "compras"):
        cur.execute("SELECT COUNT(*) FROM compras")
        count = cur.fetchone()[0]
        if count > 0:
            cur.execute("DELETE FROM compras")
            cambios.append(f"compras: {count} registros eliminados")

    conn.commit()
    conn.close()

    if cambios:
        print(f"[migrar] OK. Cambios: {len(cambios)}")
        for c in cambios:
            print(f"   + {c}")
    else:
        print("[migrar] Todo en orden, no hay cambios pendientes.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"[migrar] ERROR: {e}")
        sys.exit(1)
