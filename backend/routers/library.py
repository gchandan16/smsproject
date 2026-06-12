# backend/routers/library.py
from uuid import UUID
from typing import Optional
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel, field_validator

from database import get_db
from routers.auth import get_current_user
from models.user import User

router = APIRouter()

FINE_PER_DAY = 2.0   # ₹ per day overdue
DEFAULT_LOAN_DAYS = 14


# ─────────────────────────────────────────────────────────────
#  SCHEMAS
# ─────────────────────────────────────────────────────────────
class CategoryIn(BaseModel):
    name: str


class BookIn(BaseModel):
    title:        str
    author:       Optional[str] = None
    isbn:         Optional[str] = None
    category_id:  Optional[UUID] = None
    publisher:    Optional[str] = None
    edition:      Optional[str] = None
    publish_year: Optional[int] = None
    rack_no:      Optional[str] = None
    total_copies: int = 1
    price:        float = 0
    is_active:    bool = True
    model_config = {"extra": "ignore"}

    @field_validator("author","isbn","publisher","edition","rack_no", mode="before")
    @classmethod
    def clean_str(cls, v):
        return None if v == "" else v

    @field_validator("category_id", mode="before")
    @classmethod
    def clean_uuid(cls, v):
        return None if v in ("", None) else v

    @field_validator("publish_year", mode="before")
    @classmethod
    def clean_year(cls, v):
        if v in ("", None): return None
        try: return int(v)
        except: return None


class MemberIn(BaseModel):
    member_type: str            # student | staff
    student_id:  Optional[UUID] = None
    teacher_id:  Optional[UUID] = None
    card_no:     str
    max_books:   int = 3
    is_active:   bool = True

    @field_validator("student_id","teacher_id", mode="before")
    @classmethod
    def clean_uuid(cls, v):
        return None if v in ("", None) else v


class IssueIn(BaseModel):
    book_id:   UUID
    member_id: UUID
    due_date:  Optional[str] = None
    remarks:   Optional[str] = None


class ReturnIn(BaseModel):
    fine_paid: bool = False
    remarks:   Optional[str] = None


# ─────────────────────────────────────────────────────────────
#  DASHBOARD SUMMARY
# ─────────────────────────────────────────────────────────────
@router.get("/summary")
def library_summary(db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    tid = str(cu.tenant_id)

    def safe_scalar(sql, params=None):
        try:
            return db.execute(text(sql), params or {"tid": tid}).scalar() or 0
        except Exception:
            return 0

    total_books = safe_scalar("SELECT COALESCE(SUM(total_copies),0)::int FROM library_books WHERE tenant_id=:tid AND is_active=true")
    available   = safe_scalar("SELECT COALESCE(SUM(available_copies),0)::int FROM library_books WHERE tenant_id=:tid AND is_active=true")
    issued      = safe_scalar("SELECT COUNT(*)::int FROM library_issues WHERE tenant_id=:tid AND status='issued'")
    overdue     = safe_scalar("""
        SELECT COUNT(*)::int FROM library_issues
        WHERE tenant_id=:tid AND status='issued' AND due_date < CURRENT_DATE
    """)
    members     = safe_scalar("SELECT COUNT(*)::int FROM library_members WHERE tenant_id=:tid AND is_active=true")

    return {
        "total_books":     total_books,
        "available_books": available,
        "issued_books":    issued,
        "overdue_books":   overdue,
        "total_members":   members,
    }


# ─────────────────────────────────────────────────────────────
#  CATEGORIES
# ─────────────────────────────────────────────────────────────
@router.get("/categories")
def list_categories(db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    rows = db.execute(text("""
        SELECT id, name FROM book_categories WHERE tenant_id=:tid ORDER BY name
    """), {"tid": str(cu.tenant_id)}).fetchall()
    return [{"id": str(r.id), "name": r.name} for r in rows]


@router.post("/categories", status_code=201)
def create_category(data: CategoryIn, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    try:
        r = db.execute(text("""
            INSERT INTO book_categories (tenant_id, name) VALUES (:tid,:name) RETURNING id
        """), {"tid": str(cu.tenant_id), "name": data.name}).fetchone()
        db.commit()
        return {"id": str(r.id), "name": data.name}
    except Exception as e:
        db.rollback()
        if "unique" in str(e).lower():
            raise HTTPException(409, f"Category '{data.name}' already exists")
        raise HTTPException(500, str(e))


@router.delete("/categories/{cat_id}", status_code=204)
def delete_category(cat_id: UUID, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    db.execute(text("DELETE FROM book_categories WHERE id=:id AND tenant_id=:tid"),
               {"id": str(cat_id), "tid": str(cu.tenant_id)})
    db.commit()


# ─────────────────────────────────────────────────────────────
#  BOOKS
# ─────────────────────────────────────────────────────────────
@router.get("/books")
def list_books(
    search:      Optional[str] = None,
    category_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    params = {"tid": str(cu.tenant_id)}
    extra  = ""
    if search:
        extra += " AND (b.title ILIKE :q OR b.author ILIKE :q OR b.isbn ILIKE :q)"
        params["q"] = f"%{search}%"
    if category_id:
        extra += " AND b.category_id = :cat"
        params["cat"] = str(category_id)

    try:
        rows = db.execute(text(f"""
            SELECT b.id, b.title, b.author, b.isbn, b.publisher, b.edition,
                   b.publish_year, b.rack_no, b.total_copies, b.available_copies,
                   b.price, b.is_active,
                   c.id AS category_id, c.name AS category_name
            FROM library_books b
            LEFT JOIN book_categories c ON c.id = b.category_id
            WHERE b.tenant_id = :tid {extra}
            ORDER BY b.title
        """), params).fetchall()
    except Exception as e:
        raise HTTPException(500, f"Failed to load books: {str(e)}")

    return [
        {
            "id":               str(r.id),
            "title":            r.title,
            "author":           r.author,
            "isbn":             r.isbn,
            "publisher":        r.publisher,
            "edition":          r.edition,
            "publish_year":     r.publish_year,
            "rack_no":          r.rack_no,
            "total_copies":     r.total_copies,
            "available_copies": r.available_copies,
            "issued_copies":    r.total_copies - r.available_copies,
            "price":            float(r.price),
            "is_active":        r.is_active,
            "category_id":      str(r.category_id) if r.category_id else None,
            "category_name":    r.category_name,
        }
        for r in rows
    ]


@router.post("/books", status_code=201)
def create_book(data: BookIn, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    try:
        r = db.execute(text("""
            INSERT INTO library_books
                (tenant_id, title, author, isbn, category_id, publisher,
                 edition, publish_year, rack_no, total_copies, available_copies,
                 price, is_active)
            VALUES
                (:tid,:title,:author,:isbn,:cat,:pub,
                 :ed,:yr,:rack,:total,:total,
                 :price,:active)
            RETURNING id
        """), {
            "tid": str(cu.tenant_id), "title": data.title, "author": data.author,
            "isbn": data.isbn,
            "cat": str(data.category_id) if data.category_id else None,
            "pub": data.publisher, "ed": data.edition, "yr": data.publish_year,
            "rack": data.rack_no, "total": data.total_copies,
            "price": data.price, "active": data.is_active,
        }).fetchone()
        db.commit()
        return {"id": str(r.id), "title": data.title}
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Failed to add book: {str(e)}")


@router.put("/books/{book_id}")
def update_book(book_id: UUID, data: BookIn, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    # Get current issued count to preserve availability balance
    cur = db.execute(text("""
        SELECT total_copies, available_copies FROM library_books
        WHERE id=:id AND tenant_id=:tid
    """), {"id": str(book_id), "tid": str(cu.tenant_id)}).fetchone()
    if not cur:
        raise HTTPException(404, "Book not found")

    issued = cur.total_copies - cur.available_copies
    new_available = max(data.total_copies - issued, 0)

    try:
        db.execute(text("""
            UPDATE library_books
            SET title=:title, author=:author, isbn=:isbn, category_id=:cat,
                publisher=:pub, edition=:ed, publish_year=:yr, rack_no=:rack,
                total_copies=:total, available_copies=:avail,
                price=:price, is_active=:active
            WHERE id=:id AND tenant_id=:tid
        """), {
            "id": str(book_id), "tid": str(cu.tenant_id),
            "title": data.title, "author": data.author, "isbn": data.isbn,
            "cat": str(data.category_id) if data.category_id else None,
            "pub": data.publisher, "ed": data.edition, "yr": data.publish_year,
            "rack": data.rack_no, "total": data.total_copies, "avail": new_available,
            "price": data.price, "active": data.is_active,
        })
        db.commit()
        return {"message": "Updated"}
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Update failed: {str(e)}")


@router.delete("/books/{book_id}", status_code=204)
def delete_book(book_id: UUID, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    issued = db.execute(text("""
        SELECT COUNT(*) FROM library_issues
        WHERE book_id=:id AND status='issued'
    """), {"id": str(book_id)}).scalar()
    if issued:
        raise HTTPException(400, f"Cannot delete — {issued} copy(s) currently issued")
    db.execute(text("DELETE FROM library_books WHERE id=:id AND tenant_id=:tid"),
               {"id": str(book_id), "tid": str(cu.tenant_id)})
    db.commit()


# ─────────────────────────────────────────────────────────────
#  MEMBERS
# ─────────────────────────────────────────────────────────────
@router.get("/members")
def list_members(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    params = {"tid": str(cu.tenant_id)}
    extra  = ""
    if search:
        extra = " AND (s.first_name ILIKE :q OR s.last_name ILIKE :q OR s.admission_no ILIKE :q OR t.name ILIKE :q OR m.card_no ILIKE :q)"
        params["q"] = f"%{search}%"

    try:
        rows = db.execute(text(f"""
            SELECT
                m.id, m.member_type, m.card_no, m.max_books, m.is_active,
                s.id AS student_id, s.first_name, s.last_name, s.admission_no,
                t.id AS teacher_id, t.name AS teacher_name,
                COUNT(li.id) FILTER (WHERE li.status='issued')::int AS books_held
            FROM library_members m
            LEFT JOIN students s ON s.id = m.student_id
            LEFT JOIN teachers t ON t.id = m.teacher_id
            LEFT JOIN library_issues li ON li.member_id = m.id
            WHERE m.tenant_id=:tid {extra}
            GROUP BY m.id, m.member_type, m.card_no, m.max_books, m.is_active,
                     s.id, s.first_name, s.last_name, s.admission_no,
                     t.id, t.name
            ORDER BY m.card_no
        """), params).fetchall()
    except Exception as e:
        raise HTTPException(500, f"Failed to load members: {str(e)}")

    return [
        {
            "id":          str(r.id),
            "member_type": r.member_type,
            "card_no":     r.card_no,
            "max_books":   r.max_books,
            "is_active":   r.is_active,
            "books_held":  r.books_held,
            "name": (
                f"{r.first_name} {r.last_name or ''}".strip()
                if r.member_type == "student" else r.teacher_name
            ),
            "identifier": r.admission_no if r.member_type == "student" else "Staff",
            "student_id": str(r.student_id) if r.student_id else None,
            "teacher_id": str(r.teacher_id) if r.teacher_id else None,
        }
        for r in rows
    ]


@router.post("/members", status_code=201)
def create_member(data: MemberIn, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    if data.member_type == "student" and not data.student_id:
        raise HTTPException(400, "student_id required for student member")
    if data.member_type == "staff" and not data.teacher_id:
        raise HTTPException(400, "teacher_id required for staff member")

    try:
        r = db.execute(text("""
            INSERT INTO library_members
                (tenant_id, member_type, student_id, teacher_id, card_no, max_books, is_active)
            VALUES (:tid,:mtype,:sid,:tid2,:card,:max,:active)
            RETURNING id
        """), {
            "tid": str(cu.tenant_id), "mtype": data.member_type,
            "sid": str(data.student_id) if data.student_id else None,
            "tid2": str(data.teacher_id) if data.teacher_id else None,
            "card": data.card_no, "max": data.max_books, "active": data.is_active,
        }).fetchone()
        db.commit()
        return {"id": str(r.id), "card_no": data.card_no}
    except Exception as e:
        db.rollback()
        if "unique" in str(e).lower():
            raise HTTPException(409, f"Card No '{data.card_no}' already exists")
        raise HTTPException(500, f"Failed: {str(e)}")


@router.delete("/members/{member_id}", status_code=204)
def delete_member(member_id: UUID, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    issued = db.execute(text("""
        SELECT COUNT(*) FROM library_issues WHERE member_id=:id AND status='issued'
    """), {"id": str(member_id)}).scalar()
    if issued:
        raise HTTPException(400, f"Cannot delete — member has {issued} book(s) issued")
    db.execute(text("DELETE FROM library_members WHERE id=:id AND tenant_id=:tid"),
               {"id": str(member_id), "tid": str(cu.tenant_id)})
    db.commit()


# ─────────────────────────────────────────────────────────────
#  ISSUE / RETURN
# ─────────────────────────────────────────────────────────────
@router.get("/issues")
def list_issues(
    status: Optional[str] = None,
    member_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    cu: User    = Depends(get_current_user),
):
    params = {"tid": str(cu.tenant_id)}
    extra  = ""
    if status:
        extra += " AND li.status = :status"
        params["status"] = status
    if member_id:
        extra += " AND li.member_id = :mid"
        params["mid"] = str(member_id)

    try:
        rows = db.execute(text(f"""
            SELECT
                li.id, li.issue_date, li.due_date, li.return_date,
                li.fine_amount, li.fine_paid, li.status, li.remarks,
                b.id AS book_id, b.title, b.author,
                m.id AS member_id, m.card_no, m.member_type,
                s.first_name, s.last_name, s.admission_no,
                t.name AS teacher_name
            FROM library_issues li
            JOIN library_books b   ON b.id = li.book_id
            JOIN library_members m ON m.id = li.member_id
            LEFT JOIN students s   ON s.id = m.student_id
            LEFT JOIN teachers t   ON t.id = m.teacher_id
            WHERE li.tenant_id = :tid {extra}
            ORDER BY li.issue_date DESC, li.created_at DESC
        """), params).fetchall()
    except Exception as e:
        raise HTTPException(500, f"Failed to load issues: {str(e)}")

    today = date.today()
    result = []
    for r in rows:
        days_overdue = max((today - r.due_date).days, 0) if r.status == 'issued' else 0
        calc_fine = days_overdue * FINE_PER_DAY
        result.append({
            "id":           str(r.id),
            "book_id":      str(r.book_id),
            "book_title":   r.title,
            "book_author":  r.author,
            "member_id":    str(r.member_id),
            "card_no":      r.card_no,
            "member_name": (
                f"{r.first_name} {r.last_name or ''}".strip()
                if r.member_type == "student" else r.teacher_name
            ),
            "admission_no": r.admission_no,
            "issue_date":   str(r.issue_date),
            "due_date":     str(r.due_date),
            "return_date":  str(r.return_date) if r.return_date else None,
            "fine_amount":  float(r.fine_amount),
            "calc_fine":    calc_fine,
            "fine_paid":    r.fine_paid,
            "status":       'overdue' if (r.status=='issued' and days_overdue>0) else r.status,
            "days_overdue": days_overdue,
            "remarks":      r.remarks,
        })
    return result


@router.post("/issues", status_code=201)
def issue_book(data: IssueIn, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    # Check book availability
    book = db.execute(text("""
        SELECT available_copies, title FROM library_books WHERE id=:id AND tenant_id=:tid
    """), {"id": str(data.book_id), "tid": str(cu.tenant_id)}).fetchone()
    if not book:
        raise HTTPException(404, "Book not found")
    if book.available_copies <= 0:
        raise HTTPException(400, f"'{book.title}' has no available copies")

    # Check member limit
    member = db.execute(text("""
        SELECT max_books, is_active FROM library_members WHERE id=:id AND tenant_id=:tid
    """), {"id": str(data.member_id), "tid": str(cu.tenant_id)}).fetchone()
    if not member:
        raise HTTPException(404, "Member not found")
    if not member.is_active:
        raise HTTPException(400, "Member account is inactive")

    held = db.execute(text("""
        SELECT COUNT(*) FROM library_issues WHERE member_id=:id AND status='issued'
    """), {"id": str(data.member_id)}).scalar()
    if held >= member.max_books:
        raise HTTPException(400, f"Member already has {held}/{member.max_books} books issued")

    due_date = data.due_date or str(date.today() + timedelta(days=DEFAULT_LOAN_DAYS))

    try:
        r = db.execute(text("""
            INSERT INTO library_issues
                (tenant_id, book_id, member_id, issue_date, due_date, status, remarks)
            VALUES (:tid,:bid,:mid,CURRENT_DATE,:due,'issued',:remarks)
            RETURNING id
        """), {
            "tid": str(cu.tenant_id), "bid": str(data.book_id),
            "mid": str(data.member_id), "due": due_date, "remarks": data.remarks,
        }).fetchone()

        db.execute(text("""
            UPDATE library_books SET available_copies = available_copies - 1
            WHERE id = :id
        """), {"id": str(data.book_id)})

        db.commit()
        return {"id": str(r.id), "message": "Book issued", "due_date": due_date}
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Issue failed: {str(e)}")


@router.put("/issues/{issue_id}/return")
def return_book(issue_id: UUID, data: ReturnIn, db: Session = Depends(get_db), cu: User = Depends(get_current_user)):
    issue = db.execute(text("""
        SELECT book_id, due_date, status FROM library_issues
        WHERE id=:id AND tenant_id=:tid
    """), {"id": str(issue_id), "tid": str(cu.tenant_id)}).fetchone()
    if not issue:
        raise HTTPException(404, "Issue record not found")
    if issue.status != 'issued':
        raise HTTPException(400, "This book has already been returned")

    days_overdue = max((date.today() - issue.due_date).days, 0)
    fine = days_overdue * FINE_PER_DAY

    try:
        db.execute(text("""
            UPDATE library_issues
            SET return_date=CURRENT_DATE, status='returned',
                fine_amount=:fine, fine_paid=:paid, remarks=:remarks
            WHERE id=:id
        """), {"id": str(issue_id), "fine": fine, "paid": data.fine_paid, "remarks": data.remarks})

        db.execute(text("""
            UPDATE library_books SET available_copies = available_copies + 1
            WHERE id=:id
        """), {"id": str(issue.book_id)})

        db.commit()
        return {"message": "Book returned", "fine": fine, "days_overdue": days_overdue}
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Return failed: {str(e)}")
