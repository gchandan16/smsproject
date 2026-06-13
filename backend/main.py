# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine,Base
from logger_config import logger

# Import models so Base knows about every table 
from models.tenant  import Tenant
from models.role    import Role
from models.user    import User
from models.academic_year import AcademicYear 
from models.fee           import (              
    FeeCategory, FeeStructure, FeeInvoice, FeeInvoiceItem, FeePayment
)
from models.master  import (Department,Designation,LeaveType,BookCategory,GradingScheme,DiscountType,SchoolProfile)
from models.student import Student, Guardian, Grade, Section,Subject, StudentEnrollment
from models.attendance    import (             
    StudentAttendance, StaffAttendance, Holiday
)
from models.exam import (                     
    ExamType, Exam, ExamSchedule, ExamResult, ReportCard
)

# Imports router
from routers import auth
from routers.students import router as students_router
from routers.upload   import router as upload_router
from routers.academic import router as academic_router
from routers.master   import router as master_router
from routers.attendance import router as attendance_router
from routers.fees       import router as fees_router
from routers.reports    import router as reports_router
from routers.exams      import router as exams_router
from routers.users      import router as users_router
from routers.timetable  import router as timetable_router
from routers.teacher_room import router as teacher_room_router
from routers.transport    import router as transport_router
from routers.library      import router as library_router
from routers.finance_reports import router as finance_reports_router
from routers.certificates  import router as certificates_router
# Auto-create any missing tables on startup
Base.metadata.create_all(bind=engine)

# Create all tables automatically on startup

app = FastAPI(
    title="School Management System API",
    description="Enterprise SMS backend — FastAPI + PostgreSQL",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev server
        "http://localhost:3000",   # alternate React dev
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers will be uncommented as you build each module ────
# from routers import auth, students, attendance, fees, exams
# app.include_router(auth.router,        prefix="/api/auth",        tags=["Auth"])
# app.include_router(students.router,    prefix="/api/students",    tags=["Students"])
# app.include_router(attendance.router,  prefix="/api/attendance",  tags=["Attendance"])
# app.include_router(fees.router,        prefix="/api/fees",        tags=["Fees"])
# app.include_router(exams.router,       prefix="/api/exams",       tags=["Exams"])

#--------Routers--------------------------------------------
app.include_router(auth.router,prefix="/api/auth",tags=["Auth"])
app.include_router(students_router,prefix="/api/students",tags=["Students"])
app.include_router(upload_router,prefix="/api/upload",tags=["Upload"])
app.include_router(academic_router, prefix="/api/academic-years", tags=["Academic Years"])
app.include_router(master_router,   prefix="/api/master",         tags=["Master Data"])
app.include_router(attendance_router, prefix="/api/attendance",     tags=["Attendance"])
app.include_router(fees_router,       prefix="/api/fees",           tags=["Fees"])
app.include_router(reports_router,    prefix="/api/reports",        tags=["Reports"])
app.include_router(exams_router,      prefix="/api/exams",          tags=["Exams"])
app.include_router(users_router,      prefix="/api/users",          tags=["Users"])
app.include_router(timetable_router,  prefix="/api/timetable",      tags=["Timetable"])
app.include_router(teacher_room_router, prefix="/api",           tags=["Teachers & Rooms"])
app.include_router(transport_router,    prefix="/api/transport",      tags=["Transport"])
app.include_router(library_router,      prefix="/api/library",        tags=["Library"])
app.include_router(finance_reports_router, prefix="/api/finance-reports", tags=["Finance Reports"])
app.include_router(certificates_router,    prefix="/api/certificates",   tags=["Certificates"])
# Add more as you build each module:
# from routers import students, attendance, fees
# app.include_router(students.router,   prefix="/api/students",   tags=["Students"])
# app.include_router(attendance.router, prefix="/api/attendance", tags=["Attendance"])

@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "SMS API v1.0.0"}

@app.get("/", tags=["Health"])
def root():
    return {
        "message": "SMS API is running.",
        "docs": "/docs",
        "redoc": "/redoc",
    }
