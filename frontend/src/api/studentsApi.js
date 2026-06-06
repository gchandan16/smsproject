// frontend/src/api/studentsApi.js
import api from './client'

const studentsApi = {

  getStudents: async (params = {}) => {
    // ── Strip empty/null/undefined values before sending ────
    // FastAPI rejects empty string "" for UUID fields → 422 error
    const cleanParams = {}
    Object.entries(params).forEach(([key, val]) => {
      if (val !== '' && val !== null && val !== undefined) {
        cleanParams[key] = val
      }
    })
    const { data } = await api.get('/students/', { params: cleanParams })
    return data
  },

  getStudent: async (id) => {
    const { data } = await api.get(`/students/${id}`)
    return data
  },

  getStats: async () => {
    const { data } = await api.get('/students/stats')
    return data
  },

  createStudent: async (payload) => {
    const { data } = await api.post('/students/', payload)
    return data
  },

  updateStudent: async (id, payload) => {
    console.log(payload)
    const { data } = await api.put(`/students/${id}`, payload)
    return data
  },

  deleteStudent: async (id) => {
    await api.delete(`/students/${id}`)
    return id
  },

  addGuardian: async (studentId, payload) => {
    const { data } = await api.post(`/students/${studentId}/guardians`, payload)
    return data
  },

  updateGuardian: async (guardianId, payload) => {
    const { data } = await api.put(`/students/guardians/${guardianId}`, payload)
    return data
  },

  deleteGuardian: async (guardianId) => {
    await api.delete(`/students/guardians/${guardianId}`)
    return guardianId
  },

  enrollStudent: async (studentId, payload) => {
    const { data } = await api.post(`/students/${studentId}/enroll`, payload)
    return data
  },

  getGrades: async () => {
    const { data } = await api.get('/students/grades/all')
    return data
  },

  createGrade: async (payload) => {
    const { data } = await api.post('/students/grades', payload)
    return data
  },

  getSections: async (gradeId, academicYearId) => {
    const { data } = await api.get('/students/sections/by-grade', {
      params: { grade_id: gradeId, academic_year_id: academicYearId },
    })
    return data
  },

  createSection: async (payload) => {
    const { data } = await api.post('/students/sections', payload)
    return data
  },
}

export default studentsApi
