// frontend/src/api/reportsApi.js
import api from './client'

const reportsApi = {
  // ── Dashboard ─────────────────────────────────────────────
  getDashboard: (academicYearId) =>
    api.get('/reports/dashboard', {
      params: academicYearId ? { academic_year_id: academicYearId } : {}
    }).then(r => r.data),

  // ── Attendance ────────────────────────────────────────────
  getAttendanceSummary: (params) =>
    api.get('/reports/attendance/summary', { params }).then(r => r.data),

  getLowAttendance: (params) =>
    api.get('/reports/attendance/low', { params }).then(r => r.data),

  getGenderAttendance: (params) =>
    api.get('/reports/attendance/gender', { params }).then(r => r.data),

  // ── Fees ──────────────────────────────────────────────────
  getFeeCollection: (params) =>
    api.get('/reports/fees/collection', { params }).then(r => r.data),

  getDailyFees: (params) =>
    api.get('/reports/fees/daily', { params }).then(r => r.data),

  getOutstandingFees: (params) =>
    api.get('/reports/fees/outstanding', { params }).then(r => r.data),

  getMonthlyTrend: (academicYearId) =>
    api.get('/reports/fees/monthly-trend', {
      params: { academic_year_id: academicYearId }
    }).then(r => r.data),

  // ── Students ──────────────────────────────────────────────
  getStudentStrength: (academicYearId) =>
    api.get('/reports/students/strength', {
      params: { academic_year_id: academicYearId }
    }).then(r => r.data),

  getStudentReportCard: (enrollmentId, academicYearId) =>
    api.get(`/reports/students/${enrollmentId}/report-card`, {
      params: { academic_year_id: academicYearId }
    }).then(r => r.data),

  // ── Exams ─────────────────────────────────────────────────
  getExamSummary: (params) =>
    api.get('/reports/exams/summary', { params }).then(r => r.data),

  getToppers: (examId, topN = 10) =>
    api.get('/reports/exams/toppers', {
      params: { exam_id: examId, top_n: topN }
    }).then(r => r.data),
}

export default reportsApi
