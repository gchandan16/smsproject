// frontend/src/api/examsApi.js
import api from './client'

const examsApi = {
  // Exam Types
  getTypes:      ()         => api.get('/exams/types').then(r => r.data),
  createType:    (d)        => api.post('/exams/types', d).then(r => r.data),
  updateType:    (id, d)    => api.put(`/exams/types/${id}`, d).then(r => r.data),
  deleteType:    (id)       => api.delete(`/exams/types/${id}`),

  // Exams
  getExams:      (params)   => api.get('/exams/', { params }).then(r => r.data),
  getExam:       (id)       => api.get(`/exams/${id}`).then(r => r.data),
  createExam:    (d)        => api.post('/exams/', d).then(r => r.data),
  updateExam:    (id, d)    => api.put(`/exams/${id}`, d).then(r => r.data),
  deleteExam:    (id)       => api.delete(`/exams/${id}`),

  // Schedules
  addSchedule:   (examId, d)         => api.post(`/exams/${examId}/schedules`, d).then(r => r.data),
  deleteSchedule:(examId, scheduleId)=> api.delete(`/exams/${examId}/schedules/${scheduleId}`),

  // Students + Results
  getScheduleStudents: (examId, scheduleId) =>
    api.get(`/exams/${examId}/schedules/${scheduleId}/students`).then(r => r.data),

  bulkEnterResults: (examId, payload) =>
    api.post(`/exams/${examId}/results/bulk`, payload).then(r => r.data),

  enterResult: (examId, payload) =>
    api.post(`/exams/${examId}/results`, payload).then(r => r.data),

  getStudentResult: (examId, enrollmentId) =>
    api.get(`/exams/${examId}/results/${enrollmentId}`).then(r => r.data),

  // Report Cards
  generateReportCards: (examId) =>
    api.post(`/exams/${examId}/report-cards/generate`).then(r => r.data),

  getReportCards: (examId) =>
    api.get(`/exams/${examId}/report-cards`).then(r => r.data),
}

export default examsApi
