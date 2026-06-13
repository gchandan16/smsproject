# backend/routers/certificates.py
# ─────────────────────────────────────────────────────────────
# ID Cards & Bonafide Certificates — bulk PDF generation
# Registered at /api/certificates
# ─────────────────────────────────────────────────────────────
from uuid import UUID
import base64
from datetime import date
from typing import Optional, List
from io import BytesIO

from fastapi import APIRouter, Depends, Query, HTTPException, Body
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import text, bindparam

from database import get_db
from routers.auth import get_current_user
from models.user import User

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.lib.utils import ImageReader
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY

router = APIRouter()


def tid(cu): return str(cu.tenant_id)


# ─────────────────────────────────────────────────────────────
#  DATA FETCH
# ─────────────────────────────────────────────────────────────
def _get_students(db: Session, cu: User, student_ids: Optional[List[str]] = None,
                   section_id: Optional[UUID] = None, academic_year_id: Optional[UUID] = None):
    params = {"tid": tid(cu)}
    extra = ""
    bind_params = []
    if student_ids:
        # cast each id to str (UUID strings) for the IN clause
        extra += " AND s.id IN :sids"
        params["sids"] = tuple(str(x) for x in student_ids)
        bind_params.append(bindparam("sids", expanding=True))
    if section_id:
        extra += " AND se.section_id = :sec_id"
        params["sec_id"] = str(section_id)
    if academic_year_id:
        extra += " AND se.academic_year_id = :yr_id"
        params["yr_id"] = str(academic_year_id)

    sql = text(f"""
        SELECT
            s.id, s.admission_no, s.first_name, s.last_name,
            s.dob, s.gender, s.blood_group, s.photo_url, s.address,
            g.name AS grade_name, sec.name AS section_name,
            se.roll_no,
            t.name AS school_name, t.logo_url,
            g_father.first_name AS father_first, g_father.last_name AS father_last, g_father.phone AS father_phone,
            g_mother.first_name AS mother_first, g_mother.last_name AS mother_last, g_mother.phone AS mother_phone
        FROM students s
        JOIN tenants t ON t.id = s.tenant_id
        LEFT JOIN student_enrollments se ON se.student_id=s.id AND se.status='active'
        LEFT JOIN sections sec ON sec.id = se.section_id
        LEFT JOIN grades g     ON g.id   = sec.grade_id
        LEFT JOIN guardians g_father ON g_father.student_id=s.id AND g_father.relation='father'
        LEFT JOIN guardians g_mother ON g_mother.student_id=s.id AND g_mother.relation='mother'
        WHERE s.tenant_id = :tid AND s.is_active = true {extra}
        ORDER BY g.order_no NULLS LAST, sec.name, se.roll_no NULLS LAST, s.first_name
    """)
    if bind_params:
        sql = sql.bindparams(*bind_params)

    rows = db.execute(sql, params).fetchall()

    if not rows:
        raise HTTPException(404, "No students found matching the criteria")
    return rows


# ═══════════════════════════════════════════════════════════════
#  ID CARDS  — credit-card size, 2 per row, 5 per column (A4)
# ═══════════════════════════════════════════════════════════════
CARD_W = 95 * mm
CARD_H = 58 * mm


def _draw_id_card_front(c: pdfcanvas.Canvas, x, y, student):
    """Draw a single ID card front-side at position (x,y) = top-left."""
    # Card border
    c.setStrokeColor(colors.HexColor("#1E3A5F"))
    c.setLineWidth(1)
    c.roundRect(x, y - CARD_H, CARD_W, CARD_H, 4*mm, stroke=1, fill=0)

    # Header bar
    c.setFillColor(colors.HexColor("#1E3A5F"))
    c.roundRect(x, y - 12*mm, CARD_W, 12*mm, 4*mm, stroke=0, fill=1)
    # Cover bottom rounding of header
    c.rect(x, y - 12*mm, CARD_W, 4*mm, stroke=0, fill=1)

    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 9)
    school_name = (student.school_name or "School Name")[:40]
    c.drawCentredString(x + CARD_W/2, y - 5*mm, school_name)
    c.setFont("Helvetica", 6.5)
    c.drawCentredString(x + CARD_W/2, y - 9.5*mm, "STUDENT IDENTITY CARD")

    # School logo (top-left of header bar), if available
    logo_url = getattr(student, "logo_url", None)
    if logo_url and logo_url.startswith("data:image"):
        try:
            _, logo_b64 = logo_url.split(",", 1)
            logo_bytes = base64.b64decode(logo_b64)
            logo_img = ImageReader(BytesIO(logo_bytes))
            logo_size = 8*mm
            c.drawImage(logo_img, x + 2*mm, y - 10*mm, width=logo_size, height=logo_size,
                        preserveAspectRatio=True, anchor='c', mask='auto')
        except Exception:
            pass

    # Photo — draw actual photo if available, else placeholder
    photo_size = 20*mm
    photo_x = x + 4*mm
    photo_y = y - 12*mm - photo_size - 2*mm

    photo_drawn = False
    if student.photo_url and student.photo_url.startswith("data:image"):
        try:
            header, b64data = student.photo_url.split(",", 1)
            img_bytes = base64.b64decode(b64data)
            img = ImageReader(BytesIO(img_bytes))
            c.drawImage(img, photo_x, photo_y, width=photo_size, height=photo_size,
                        preserveAspectRatio=True, anchor='c', mask='auto')
            photo_drawn = True
        except Exception:
            photo_drawn = False

    if not photo_drawn:
        c.setStrokeColor(colors.HexColor("#CBD5E1"))
        c.setFillColor(colors.HexColor("#F1F5F9"))
        c.rect(photo_x, photo_y, photo_size, photo_size, stroke=1, fill=1)
        c.setFillColor(colors.HexColor("#94A3B8"))
        c.setFont("Helvetica", 6)
        c.drawCentredString(photo_x + photo_size/2, photo_y + photo_size/2, "PHOTO")

    # Photo border (drawn over the image too, for a clean frame)
    c.setStrokeColor(colors.HexColor("#CBD5E1"))
    c.rect(photo_x, photo_y, photo_size, photo_size, stroke=1, fill=0)

    # Student details (right of photo)
    info_x = photo_x + photo_size + 3*mm
    info_y = y - 16*mm
    name = f"{student.first_name} {student.last_name or ''}".strip()
    c.setFillColor(colors.HexColor("#0F172A"))
    c.setFont("Helvetica-Bold", 9)
    c.drawString(info_x, info_y, name[:24])

    c.setFont("Helvetica", 6.5)
    line_h = 3.6*mm
    cls_label = f"{student.grade_name or ''} - {student.section_name or ''}".strip(' -')
    details = [
        f"Class: {cls_label or '—'}",
        f"Roll No: {student.roll_no or '—'}",
        f"Adm No: {student.admission_no}",
        f"DOB: {student.dob.strftime('%d-%b-%Y') if student.dob else '—'}",
        f"Blood Grp: {student.blood_group or '—'}",
    ]
    for i, d in enumerate(details):
        c.drawString(info_x, info_y - (i+1)*line_h, d)

    # Footer — validity
    c.setFillColor(colors.HexColor("#64748B"))
    c.setFont("Helvetica-Oblique", 5.5)
    c.drawCentredString(x + CARD_W/2, y - CARD_H + 2*mm,
        f"Valid for Academic Year {date.today().year}-{str(date.today().year+1)[2:]}")


def _draw_id_card_back(c: pdfcanvas.Canvas, x, y, student):
    """Draw the back side — address, parent info, signature."""
    c.setStrokeColor(colors.HexColor("#1E3A5F"))
    c.setLineWidth(1)
    c.roundRect(x, y - CARD_H, CARD_W, CARD_H, 4*mm, stroke=1, fill=0)

    c.setFillColor(colors.HexColor("#0F172A"))
    c.setFont("Helvetica-Bold", 7)
    c.drawString(x + 4*mm, y - 5*mm, "If found, please return to:")

    c.setFont("Helvetica", 6.5)
    school_name = (student.school_name or "School Name")
    addr = student.address or {}
    addr_line = ", ".join(filter(None, [
        addr.get("line1") if isinstance(addr, dict) else None,
        addr.get("city")  if isinstance(addr, dict) else None,
    ]))
    c.drawString(x + 4*mm, y - 9*mm, school_name[:42])

    # Parent info
    c.setFont("Helvetica-Bold", 6.5)
    c.drawString(x + 4*mm, y - 16*mm, "Parent / Guardian Contact:")
    c.setFont("Helvetica", 6.5)
    father = f"{student.father_first or ''} {student.father_last or ''}".strip()
    mother = f"{student.mother_first or ''} {student.mother_last or ''}".strip()
    yy = y - 20*mm
    if father:
        c.drawString(x + 4*mm, yy, f"Father: {father}  {student.father_phone or ''}")
        yy -= 3.6*mm
    if mother:
        c.drawString(x + 4*mm, yy, f"Mother: {mother}  {student.mother_phone or ''}")
        yy -= 3.6*mm

    # Rules box
    c.setFont("Helvetica-Oblique", 5.5)
    rules = [
        "1. This card must be carried during school hours.",
        "2. Loss of card should be reported immediately.",
        "3. This card is the property of the school.",
    ]
    yy -= 2*mm
    for r in rules:
        c.drawString(x + 4*mm, yy, r)
        yy -= 3*mm

    # Signature lines
    c.setFont("Helvetica", 6)
    c.line(x + 4*mm, y - CARD_H + 8*mm, x + 35*mm, y - CARD_H + 8*mm)
    c.drawString(x + 4*mm, y - CARD_H + 5*mm, "Class Teacher")
    c.line(x + CARD_W - 35*mm, y - CARD_H + 8*mm, x + CARD_W - 4*mm, y - CARD_H + 8*mm)
    c.drawString(x + CARD_W - 32*mm, y - CARD_H + 5*mm, "Principal")


@router.post("/id-cards")
def generate_id_cards(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    """
    body: { student_ids: [...] }  OR  { section_id, academic_year_id }
    Generates a multi-page PDF, 2 cards per row, 4 rows per page (front side only),
    followed by back sides on alternating pages for double-sided printing.
    """
    student_ids       = body.get("student_ids")
    section_id        = body.get("section_id")
    academic_year_id  = body.get("academic_year_id")
    side              = body.get("side", "front")  # front | back | both

    students = _get_students(db, cu, student_ids, section_id, academic_year_id)

    buf = BytesIO()
    c = pdfcanvas.Canvas(buf, pagesize=A4)
    page_w, page_h = A4

    margin_x = 10*mm
    margin_y = 15*mm
    gap_x    = 5*mm
    gap_y    = 5*mm
    cols = 2
    rows = 4

    def draw_page(student_list, draw_fn):
        for i, student in enumerate(student_list):
            col = i % cols
            row = (i // cols) % rows
            if i > 0 and i % (cols*rows) == 0:
                c.showPage()
            x = margin_x + col * (CARD_W + gap_x)
            y = page_h - margin_y - row * (CARD_H + gap_y)
            draw_fn(c, x, y, student)
        c.showPage()

    if side in ("front", "both"):
        draw_page(students, _draw_id_card_front)
    if side in ("back", "both"):
        draw_page(students, _draw_id_card_back)

    c.save()
    buf.seek(0)

    return StreamingResponse(
        buf, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="id_cards_{date.today()}.pdf"'}
    )


# ═══════════════════════════════════════════════════════════════
#  BONAFIDE CERTIFICATES
# ═══════════════════════════════════════════════════════════════
def _bonafide_text(student, school_name, purpose, cert_no):
    name = f"{student.first_name} {student.last_name or ''}".strip()
    cls  = f"{student.grade_name or '—'} - {student.section_name or '—'}"
    father = f"{student.father_first or ''} {student.father_last or ''}".strip() or "—"
    dob  = student.dob.strftime('%d %B %Y') if student.dob else "—"
    today_str = date.today().strftime('%d %B %Y')

    body = (
        f"This is to certify that <b>{name}</b>, "
        f"son/daughter of <b>{father}</b>, "
        f"is a bona fide student of this institution, currently studying in "
        f"<b>Class {cls}</b> with Admission Number <b>{student.admission_no}</b>. "
        f"As per our school records, the date of birth of the student is <b>{dob}</b>."
    )
    if purpose:
        body += f" This certificate is issued for the purpose of <b>{purpose}</b>."
    body += " This certificate is issued on request for whatever purpose it may serve."

    return body, name, cls, today_str, cert_no


@router.post("/bonafide")
def generate_bonafide(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    """
    body: { student_ids: [...], purpose: "..." }
    Generates one A4 page per student.
    """
    student_ids = body.get("student_ids")
    purpose     = body.get("purpose", "")

    if not student_ids:
        raise HTTPException(400, "student_ids is required")

    students = _get_students(db, cu, student_ids)

    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=25*mm, rightMargin=25*mm, topMargin=25*mm, bottomMargin=25*mm
    )
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle("title", parent=styles["Heading1"],
        fontSize=18, textColor=colors.HexColor("#1E3A5F"), alignment=TA_CENTER, spaceAfter=2)
    sub_style = ParagraphStyle("sub", parent=styles["Normal"],
        fontSize=10, textColor=colors.HexColor("#64748B"), alignment=TA_CENTER, spaceAfter=20)
    cert_title_style = ParagraphStyle("certtitle", parent=styles["Heading2"],
        fontSize=14, alignment=TA_CENTER, spaceAfter=4, spaceBefore=10,
        textColor=colors.HexColor("#0F172A"))
    cert_no_style = ParagraphStyle("certno", parent=styles["Normal"],
        fontSize=9, alignment=TA_CENTER, textColor=colors.HexColor("#94A3B8"), spaceAfter=20)
    body_style = ParagraphStyle("body", parent=styles["Normal"],
        fontSize=12, alignment=TA_JUSTIFY, leading=22, spaceAfter=30)

    elements = []
    for idx, student in enumerate(students):
        school_name = student.school_name or "School Name"
        cert_no = f"BC/{date.today().year}/{str(idx+1).zfill(4)}"
        body_text, name, cls, today_str, cert_no = _bonafide_text(student, school_name, purpose, cert_no)

        elements.append(Paragraph(school_name, title_style))
        elements.append(Paragraph("Affiliated School &bull; Recognised Institution", sub_style))
        elements.append(Spacer(1, 30))
        elements.append(Paragraph("BONAFIDE CERTIFICATE", cert_title_style))
        elements.append(Paragraph(f"Certificate No: {cert_no}", cert_no_style))
        elements.append(Spacer(1, 20))
        elements.append(Paragraph(body_text, body_style))
        elements.append(Spacer(1, 50))

        # Date + signature row
        sig_table = Table(
            [[f"Date: {today_str}", "Principal\n(Signature & Seal)"]],
            colWidths=[doc.width/2, doc.width/2]
        )
        sig_table.setStyle(TableStyle([
            ("FONTSIZE", (0,0), (-1,-1), 10),
            ("ALIGN", (1,0), (1,0), "RIGHT"),
            ("VALIGN", (0,0), (-1,-1), "TOP"),
        ]))
        elements.append(sig_table)

        if idx < len(students) - 1:
            from reportlab.platypus import PageBreak
            elements.append(PageBreak())

    doc.build(elements)
    buf.seek(0)

    filename = "bonafide_certificate" if len(students)==1 else f"bonafide_certificates_{date.today()}"
    return StreamingResponse(
        buf, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}.pdf"'}
    )


# ═══════════════════════════════════════════════════════════════
#  STUDENT LOOKUP — for the frontend picker
# ═══════════════════════════════════════════════════════════════
@router.get("/students-lookup")
def students_lookup(
    section_id:       Optional[UUID] = Query(None),
    academic_year_id: Optional[UUID] = Query(None),
    search:           Optional[str]  = Query(None),
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    params = {"tid": tid(cu)}
    extra = ""
    if section_id:
        extra += " AND se.section_id = :sec_id"
        params["sec_id"] = str(section_id)
    if academic_year_id:
        extra += " AND se.academic_year_id = :yr_id"
        params["yr_id"] = str(academic_year_id)
    if search:
        extra += " AND (s.first_name ILIKE :q OR s.last_name ILIKE :q OR s.admission_no ILIKE :q)"
        params["q"] = f"%{search}%"

    rows = db.execute(text(f"""
        SELECT s.id, s.first_name, s.last_name, s.admission_no,
               g.name AS grade_name, sec.name AS section_name
        FROM students s
        LEFT JOIN student_enrollments se ON se.student_id=s.id AND se.status='active'
        LEFT JOIN sections sec ON sec.id = se.section_id
        LEFT JOIN grades g     ON g.id   = sec.grade_id
        WHERE s.tenant_id = :tid AND s.is_active=true {extra}
        ORDER BY g.order_no NULLS LAST, sec.name, s.first_name
        LIMIT 200
    """), params).fetchall()

    return [
        {
            "id": str(r.id),
            "name": f"{r.first_name} {r.last_name or ''}".strip(),
            "admission_no": r.admission_no,
            "class": f"{r.grade_name or ''} {r.section_name or ''}".strip() or "—",
        }
        for r in rows
    ]
