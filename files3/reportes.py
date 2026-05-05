"""
Endpoints de reportes:
- Ventas por día / rango de fechas
- Productos más vendidos
- Ganancia estimada
- Datos para gráficos
"""
from datetime import date, datetime, timedelta
from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
import models
import schemas

router = APIRouter(prefix="/reportes", tags=["Reportes"])


@router.get("/rango", response_model=schemas.ReporteVentas)
def reporte_por_rango(
    fecha_inicio: date,
    fecha_fin: date,
    top_productos: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """
    Reporte completo de ventas en un rango de fechas:
    - Total vendido
    - Cantidad de ventas
    - Ganancia estimada (precio_venta - costo)
    - Top N productos más vendidos
    """
    inicio = datetime.combine(fecha_inicio, datetime.min.time())
    fin = datetime.combine(fecha_fin, datetime.min.time()) + timedelta(days=1)

    # Total de ventas en el rango
    resultado = db.query(
        func.coalesce(func.sum(models.Venta.total), 0).label("total"),
        func.count(models.Venta.id).label("cantidad"),
    ).filter(
        models.Venta.fecha >= inicio,
        models.Venta.fecha < fin,
    ).first()

    total_ventas = float(resultado.total or 0)
    cantidad_ventas = resultado.cantidad or 0

    # Ganancia estimada: suma de (precio_unit - costo_actual) * cantidad
    ganancia_query = db.query(
        func.coalesce(func.sum(
            (models.DetalleVenta.precio_unit - models.Producto.costo)
            * models.DetalleVenta.cantidad
        ), 0).label("ganancia")
    ).join(
        models.Venta, models.DetalleVenta.venta_id == models.Venta.id
    ).join(
        models.Producto, models.DetalleVenta.producto_id == models.Producto.id
    ).filter(
        models.Venta.fecha >= inicio,
        models.Venta.fecha < fin,
    ).first()

    ganancia = float(ganancia_query.ganancia or 0)

    # Top productos más vendidos
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
            cantidad_total=int(t.cantidad_total),
            monto_total=round(float(t.monto_total), 2),
        )
        for t in top
    ]

    return schemas.ReporteVentas(
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        total_ventas=round(total_ventas, 2),
        cantidad_ventas=cantidad_ventas,
        ganancia_estimada=round(ganancia, 2),
        productos_top=productos_top,
    )


@router.get("/por-dia", response_model=List[schemas.VentaPorDia])
def ventas_por_dia(
    fecha_inicio: date,
    fecha_fin: date,
    db: Session = Depends(get_db)
):
    """
    Datos para gráfico de barras: total de ventas agrupado por día.
    Devuelve un punto por cada día dentro del rango (incluso días sin ventas).
    """
    inicio = datetime.combine(fecha_inicio, datetime.min.time())
    fin = datetime.combine(fecha_fin, datetime.min.time()) + timedelta(days=1)

    resultados = db.query(
        func.date(models.Venta.fecha).label("dia"),
        func.sum(models.Venta.total).label("total"),
        func.count(models.Venta.id).label("cantidad"),
    ).filter(
        models.Venta.fecha >= inicio,
        models.Venta.fecha < fin,
    ).group_by(
        func.date(models.Venta.fecha)
    ).all()

    # Convertir a diccionario para llenar días sin ventas
    mapa = {}
    for r in resultados:
        # SQLite devuelve la fecha como string
        if isinstance(r.dia, str):
            d = datetime.strptime(r.dia, "%Y-%m-%d").date()
        else:
            d = r.dia
        mapa[d] = (float(r.total), int(r.cantidad))

    salida = []
    cursor = fecha_inicio
    while cursor <= fecha_fin:
        total, cantidad = mapa.get(cursor, (0.0, 0))
        salida.append(schemas.VentaPorDia(
            fecha=cursor,
            total=round(total, 2),
            cantidad=cantidad,
        ))
        cursor += timedelta(days=1)

    return salida


@router.get("/productos-top", response_model=List[schemas.ProductoMasVendido])
def productos_mas_vendidos(
    dias: int = Query(30, ge=1, le=365),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """
    Productos más vendidos en los últimos N días.
    Útil para gráficos en el dashboard.
    """
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
            cantidad_total=int(t.cantidad_total),
            monto_total=round(float(t.monto_total), 2),
        )
        for t in top
    ]
