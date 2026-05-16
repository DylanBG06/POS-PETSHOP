"""
Endpoints de reportes y ganancias.

Sistema de ganancias:
- Ganancia bruta = SUM((precio_unit - costo_unit) * cantidad)  ← de detalle_venta
  El costo_unit se congela al momento de la venta, así los reportes
  son siempre históricamente correctos.
- Total compras = SUM(total) de compras en el periodo
- Flujo neto = Ganancia bruta - Total compras
  (esto es flujo de caja, no utilidad contable real, porque las compras
   quedan como inventario hasta venderse)
"""
from datetime import date, datetime, timedelta
from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
import models
import schemas
from security import get_current_user

router = APIRouter(
    prefix="/reportes",
    tags=["Reportes"],
    dependencies=[Depends(get_current_user)],
)


def _rango_dt(fecha_inicio: date, fecha_fin: date):
    inicio = datetime.combine(fecha_inicio, datetime.min.time())
    fin = datetime.combine(fecha_fin, datetime.min.time()) + timedelta(days=1)
    return inicio, fin


@router.get("/rango", response_model=schemas.ReporteVentas)
def reporte_por_rango(
    fecha_inicio: date,
    fecha_fin: date,
    top_productos: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    inicio, fin = _rango_dt(fecha_inicio, fecha_fin)

    resultado = db.query(
        func.coalesce(func.sum(models.Venta.total), 0).label("total"),
        func.count(models.Venta.id).label("cantidad"),
    ).filter(
        models.Venta.fecha >= inicio,
        models.Venta.fecha < fin,
    ).first()

    total_ventas = float(resultado.total or 0)
    cantidad_ventas = resultado.cantidad or 0

    # Ganancia bruta usando costo_unit congelado
    ganancia_query = db.query(
        func.coalesce(func.sum(
            (models.DetalleVenta.precio_unit - models.DetalleVenta.costo_unit)
            * models.DetalleVenta.cantidad
        ), 0).label("ganancia")
    ).join(
        models.Venta, models.DetalleVenta.venta_id == models.Venta.id
    ).filter(
        models.Venta.fecha >= inicio,
        models.Venta.fecha < fin,
    ).first()

    ganancia = float(ganancia_query.ganancia or 0)

    # Top productos
    top = db.query(
        models.Producto.id.label("producto_id"),
        models.Producto.nombre.label("nombre"),
        func.sum(models.DetalleVenta.cantidad).label("cantidad_total"),
        func.sum(models.DetalleVenta.subtotal).label("monto_total"),
    ).join(
        models.DetalleVenta, models.DetalleVenta.producto_id == models.Producto.id
    ).join(
        models.Venta, models.DetalleVenta.venta_id == models.Venta.id
    ).filter(
        models.Venta.fecha >= inicio,
        models.Venta.fecha < fin,
    ).group_by(
        models.Producto.id, models.Producto.nombre
    ).order_by(
        func.sum(models.DetalleVenta.cantidad).desc()
    ).limit(top_productos).all()

    productos_top = [
        schemas.ProductoMasVendido(
            producto_id=t.producto_id,
            nombre=t.nombre,
            cantidad_total=float(t.cantidad_total),
            monto_total=round(float(t.monto_total), 2),
        )
        for t in top
    ]

    return schemas.ReporteVentas(
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        total_ventas=round(total_ventas, 2),
        cantidad_ventas=cantidad_ventas,
        ganancia_bruta=round(ganancia, 2),
        productos_top=productos_top,
    )


@router.get("/por-dia", response_model=List[schemas.VentaPorDia])
def ventas_por_dia(
    fecha_inicio: date,
    fecha_fin: date,
    db: Session = Depends(get_db)
):
    """Para el gráfico: total y ganancia por día."""
    inicio, fin = _rango_dt(fecha_inicio, fecha_fin)

    # Ventas por día
    ventas_dia = db.query(
        func.date(models.Venta.fecha).label("dia"),
        func.sum(models.Venta.total).label("total"),
        func.count(models.Venta.id).label("cantidad"),
    ).filter(
        models.Venta.fecha >= inicio,
        models.Venta.fecha < fin,
    ).group_by(
        func.date(models.Venta.fecha)
    ).all()

    # Ganancia por día (necesita join)
    ganancia_dia = db.query(
        func.date(models.Venta.fecha).label("dia"),
        func.sum(
            (models.DetalleVenta.precio_unit - models.DetalleVenta.costo_unit)
            * models.DetalleVenta.cantidad
        ).label("ganancia"),
    ).join(
        models.DetalleVenta, models.DetalleVenta.venta_id == models.Venta.id
    ).filter(
        models.Venta.fecha >= inicio,
        models.Venta.fecha < fin,
    ).group_by(
        func.date(models.Venta.fecha)
    ).all()

    def _parse(d):
        return datetime.strptime(d, "%Y-%m-%d").date() if isinstance(d, str) else d

    mapa_v = {_parse(r.dia): (float(r.total or 0), int(r.cantidad or 0)) for r in ventas_dia}
    mapa_g = {_parse(r.dia): float(r.ganancia or 0) for r in ganancia_dia}

    salida = []
    cursor = fecha_inicio
    while cursor <= fecha_fin:
        total, cantidad = mapa_v.get(cursor, (0.0, 0))
        ganancia = mapa_g.get(cursor, 0.0)
        salida.append(schemas.VentaPorDia(
            fecha=cursor,
            total=round(total, 2),
            cantidad=cantidad,
            ganancia=round(ganancia, 2),
        ))
        cursor += timedelta(days=1)

    return salida


@router.get("/productos-top", response_model=List[schemas.ProductoMasVendido])
def productos_mas_vendidos(
    dias: int = Query(30, ge=1, le=365),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    inicio = datetime.now() - timedelta(days=dias)

    top = db.query(
        models.Producto.id.label("producto_id"),
        models.Producto.nombre.label("nombre"),
        func.sum(models.DetalleVenta.cantidad).label("cantidad_total"),
        func.sum(models.DetalleVenta.subtotal).label("monto_total"),
    ).join(
        models.DetalleVenta, models.DetalleVenta.producto_id == models.Producto.id
    ).join(
        models.Venta, models.DetalleVenta.venta_id == models.Venta.id
    ).filter(
        models.Venta.fecha >= inicio
    ).group_by(
        models.Producto.id, models.Producto.nombre
    ).order_by(
        func.sum(models.DetalleVenta.cantidad).desc()
    ).limit(limit).all()

    return [
        schemas.ProductoMasVendido(
            producto_id=t.producto_id,
            nombre=t.nombre,
            cantidad_total=float(t.cantidad_total),
            monto_total=round(float(t.monto_total), 2),
        )
        for t in top
    ]


# ---------- GANANCIAS ----------

@router.get("/ganancia-resumen", response_model=schemas.GananciaResumen)
def ganancia_resumen(
    fecha_inicio: date,
    fecha_fin: date,
    db: Session = Depends(get_db)
):
    """KPI principal de ganancias para un rango: bruta, compras y flujo neto."""
    inicio, fin = _rango_dt(fecha_inicio, fecha_fin)

    # Ventas
    ventas_data = db.query(
        func.coalesce(func.sum(models.Venta.total), 0).label("total"),
        func.count(models.Venta.id).label("cantidad"),
    ).filter(
        models.Venta.fecha >= inicio,
        models.Venta.fecha < fin,
    ).first()

    # Ganancia bruta
    ganancia_data = db.query(
        func.coalesce(func.sum(
            (models.DetalleVenta.precio_unit - models.DetalleVenta.costo_unit)
            * models.DetalleVenta.cantidad
        ), 0).label("ganancia")
    ).join(
        models.Venta, models.DetalleVenta.venta_id == models.Venta.id
    ).filter(
        models.Venta.fecha >= inicio,
        models.Venta.fecha < fin,
    ).first()

    # Ingresos de inventario (total invertido en costo)
    ingresos_data = db.query(
        func.coalesce(func.sum(
            models.Ingreso.cantidad * models.Ingreso.costo_unit
        ), 0).label("total"),
        func.count(models.Ingreso.id).label("cantidad"),
    ).filter(
        models.Ingreso.fecha >= inicio,
        models.Ingreso.fecha < fin,
    ).first()

    # Descuentos en ventas
    descuentos_data = db.query(
        func.coalesce(func.sum(models.Venta.descuento), 0).label("total")
    ).filter(
        models.Venta.fecha >= inicio,
        models.Venta.fecha < fin,
    ).first()

    # Regalías (valor regalado al cliente)
    regalias_data = db.query(
        func.coalesce(func.sum(models.Venta.monto_regalias), 0).label("total")
    ).filter(
        models.Venta.fecha >= inicio,
        models.Venta.fecha < fin,
    ).first()

    # Costo absorbido por regalías (productos dados gratis al cliente)
    costo_regalias_data = db.query(
        func.coalesce(func.sum(
            models.DetalleVenta.costo_unit * models.DetalleVenta.cantidad
        ), 0).label("costo")
    ).join(
        models.Venta, models.DetalleVenta.venta_id == models.Venta.id
    ).filter(
        models.Venta.fecha >= inicio,
        models.Venta.fecha < fin,
        models.DetalleVenta.es_regalia == True,
    ).first()

    total_ventas = round(float(ventas_data.total or 0), 2)
    ganancia_bruta = round(float(ganancia_data.ganancia or 0), 2)
    total_compras = round(float(ingresos_data.total or 0), 2)
    total_descuentos = round(float(descuentos_data.total or 0), 2)
    total_regalias = round(float(regalias_data.total or 0), 2)
    costo_regalias = round(float(costo_regalias_data.costo or 0), 2)
    flujo_neto = round(ganancia_bruta - total_compras, 2)

    return schemas.GananciaResumen(
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        total_ventas=total_ventas,
        ganancia_bruta=ganancia_bruta,
        total_compras=total_compras,
        flujo_neto=flujo_neto,
        cantidad_ventas=ventas_data.cantidad or 0,
        cantidad_compras=ingresos_data.cantidad or 0,
        total_descuentos=total_descuentos,
        total_regalias=total_regalias,
        costo_regalias=costo_regalias,
    )


@router.get("/ganancia-por-dia", response_model=List[schemas.GananciaPorDia])
def ganancia_por_dia(
    fecha_inicio: date,
    fecha_fin: date,
    db: Session = Depends(get_db)
):
    """Ganancia día por día con compras y flujo neto."""
    inicio, fin = _rango_dt(fecha_inicio, fecha_fin)

    # Ventas y ganancia por día
    ventas_dia = db.query(
        func.date(models.Venta.fecha).label("dia"),
        func.sum(models.Venta.total).label("total"),
    ).filter(
        models.Venta.fecha >= inicio,
        models.Venta.fecha < fin,
    ).group_by(func.date(models.Venta.fecha)).all()

    ganancia_dia = db.query(
        func.date(models.Venta.fecha).label("dia"),
        func.sum(
            (models.DetalleVenta.precio_unit - models.DetalleVenta.costo_unit)
            * models.DetalleVenta.cantidad
        ).label("ganancia"),
    ).join(
        models.DetalleVenta, models.DetalleVenta.venta_id == models.Venta.id
    ).filter(
        models.Venta.fecha >= inicio,
        models.Venta.fecha < fin,
    ).group_by(func.date(models.Venta.fecha)).all()

    compras_dia = db.query(
        func.date(models.Ingreso.fecha).label("dia"),
        func.sum(models.Ingreso.cantidad * models.Ingreso.costo_unit).label("total"),
    ).filter(
        models.Ingreso.fecha >= inicio,
        models.Ingreso.fecha < fin,
    ).group_by(func.date(models.Ingreso.fecha)).all()

    def _parse(d):
        return datetime.strptime(d, "%Y-%m-%d").date() if isinstance(d, str) else d

    mapa_v = {_parse(r.dia): float(r.total or 0) for r in ventas_dia}
    mapa_g = {_parse(r.dia): float(r.ganancia or 0) for r in ganancia_dia}
    mapa_c = {_parse(r.dia): float(r.total or 0) for r in compras_dia}

    salida = []
    cursor = fecha_inicio
    while cursor <= fecha_fin:
        ventas = mapa_v.get(cursor, 0.0)
        ganancia = mapa_g.get(cursor, 0.0)
        compras = mapa_c.get(cursor, 0.0)
        salida.append(schemas.GananciaPorDia(
            fecha=cursor,
            ventas=round(ventas, 2),
            ganancia_bruta=round(ganancia, 2),
            compras=round(compras, 2),
            flujo_neto=round(ganancia - compras, 2),
        ))
        cursor += timedelta(days=1)

    return salida


@router.get("/ganancia-mensual", response_model=List[schemas.GananciaPorMes])
def ganancia_mensual(
    año: int = Query(..., ge=2000, le=2100),
    db: Session = Depends(get_db)
):
    """Devuelve los 12 meses del año con ventas, ganancia, compras y flujo neto."""
    from sqlalchemy import extract

    salida = []
    for mes in range(1, 13):
        # Rango del mes
        inicio = datetime(año, mes, 1)
        if mes == 12:
            fin = datetime(año + 1, 1, 1)
        else:
            fin = datetime(año, mes + 1, 1)

        ventas = db.query(
            func.coalesce(func.sum(models.Venta.total), 0)
        ).filter(
            models.Venta.fecha >= inicio,
            models.Venta.fecha < fin,
        ).scalar() or 0

        ganancia = db.query(
            func.coalesce(func.sum(
                (models.DetalleVenta.precio_unit - models.DetalleVenta.costo_unit)
                * models.DetalleVenta.cantidad
            ), 0)
        ).join(
            models.Venta, models.DetalleVenta.venta_id == models.Venta.id
        ).filter(
            models.Venta.fecha >= inicio,
            models.Venta.fecha < fin,
        ).scalar() or 0

        compras = db.query(
            func.coalesce(func.sum(
                models.Ingreso.cantidad * models.Ingreso.costo_unit
            ), 0)
        ).filter(
            models.Ingreso.fecha >= inicio,
            models.Ingreso.fecha < fin,
        ).scalar() or 0

        salida.append(schemas.GananciaPorMes(
            año=año,
            mes=mes,
            ventas=round(float(ventas), 2),
            ganancia_bruta=round(float(ganancia), 2),
            compras=round(float(compras), 2),
            flujo_neto=round(float(ganancia) - float(compras), 2),
        ))

    return salida
