from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from io import BytesIO
from ..database import get_db
from .. import models
from .auth import get_current_user
from datetime import datetime

router = APIRouter(prefix="/logs", tags=["logs"])

@router.get("/export/pdf")
async def export_logs_pdf(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    # Только админ
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")

    # Получаем последние 200 логов
    result = await db.execute(
        select(models.Log).order_by(desc(models.Log.created_at)).limit(200)
    )
    logs = result.scalars().all()

    # Создаём PDF в памяти
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        rightMargin=30,
        leftMargin=30,
        topMargin=30,
        bottomMargin=30
    )

    # Стили
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=16,
        spaceAfter=30,
        alignment=1  # центр
    )
    normal_style = styles['Normal']

    # Контент
    story = []

    # Заголовок
    story.append(Paragraph("Журнал событий - Инфра Монитор", title_style))
    story.append(Paragraph(f"Дата выгрузки: {datetime.now().strftime('%d.%m.%Y %H:%M:%S')}", normal_style))
    story.append(Paragraph(f"Всего записей: {len(logs)}", normal_style))
    story.append(Spacer(1, 20))

    # Подготовка данных для таблицы
    data = [["Время", "Действие", "Детали", "IP-адрес"]]

    for log in logs:
        data.append([
            log.created_at.strftime("%d.%m.%Y %H:%M:%S") if log.created_at else "-",
            log.action or "-",
            str(log.details)[:100] if log.details else "-",  # ограничим длину
            log.ip_address or "-"
        ])

    # Таблица
    table = Table(data, repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('ALIGN', (2, 1), (2, -1), 'LEFT'),  # детали выравниваем влево
    ]))

    story.append(table)

    # Сборка PDF
    doc.build(story)
    buffer.seek(0)

    return Response(
        content=buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=logs_export.pdf"}
    )
