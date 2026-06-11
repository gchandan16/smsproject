// frontend/src/api/attendanceApi.js
import api from './client'

const attendanceApi = {

  // GET /api/attendance/section/{id}?att_date=YYYY-MM-DD
  getSectionAttendance: async (sectionId, attDate, periodNo = null) => {
    const params = { att_date: attDate }
    if (periodNo !== null) params.period_no = periodNo
    const { data } = await api.get(`/attendance/section/${sectionId}`, { params })
    return data
  },

  // POST /api/attendance/bulk-mark
  bulkMark: async (payload) => {
    const { data } = await api.post('/attendance/bulk-mark', payload)
    return data
  },

  // POST /api/attendance/mark
  markSingle: async (payload) => {
    const { data } = await api.post('/attendance/mark', payload)
    return data
  },

  // GET /api/attendance/summary/student/{enrollment_id}
  getStudentSummary: async (enrollmentId, fromDate, toDate) => {
    const { data } = await api.get(`/attendance/summary/student/${enrollmentId}`, {
      params: { from_date: fromDate, to_date: toDate },
    })
    return data
  },

  // GET /api/attendance/summary/section/{section_id}
  getSectionSummary: async (sectionId, fromDate, toDate) => {
    const { data } = await api.get(`/attendance/summary/section/${sectionId}`, {
      params: { from_date: fromDate, to_date: toDate },
    })
    return data
  },

  // GET /api/attendance/monthly/{enrollment_id}
  getMonthly: async (enrollmentId, year, month) => {
    const { data } = await api.get(`/attendance/monthly/${enrollmentId}`, {
      params: { year, month },
    })
    return data
  },

  // GET /api/attendance/low-attendance
  getLowAttendance: async (academicYearId, threshold = 75) => {
    const { data } = await api.get('/attendance/low-attendance', {
      params: { academic_year_id: academicYearId, threshold },
    })
    return data
  },

  // Holidays
  getHolidays: async (fromDate, toDate) => {
    const { data } = await api.get('/attendance/holidays', {
      params: { from_date: fromDate, to_date: toDate },
    })
    return data
  },
}

export default attendanceApi
