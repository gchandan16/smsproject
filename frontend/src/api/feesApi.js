// frontend/src/api/feesApi.js
import api from './client'

const feesApi = {

  // ── Fee Structures ───────────────────────────────────────
  getStructures: (academicYearId) =>
    api.get('/fees/structures', { params: { academic_year_id: academicYearId } }).then(r => r.data),

  createStructure: (payload) =>
    api.post('/fees/structures', payload).then(r => r.data),

  updateStructure: (id, payload) =>
    api.put(`/fees/structures/${id}`, payload).then(r => r.data),

  deleteStructure: (id) =>
    api.delete(`/fees/structures/${id}`),

  // ── Invoices ─────────────────────────────────────────────
  getInvoices: (params = {}) =>
    api.get('/fees/invoices', { params }).then(r => r.data),

  getInvoice: (id) =>
    api.get(`/fees/invoices/${id}`).then(r => r.data),

  createInvoice: (payload) =>
    api.post('/fees/invoices', payload).then(r => r.data),

  generateInvoice: (payload) =>
    api.post('/fees/invoices/generate', payload).then(r => r.data),

  cancelInvoice: (id) =>
    api.post(`/fees/invoices/${id}/cancel`).then(r => r.data),

  getStudentInvoices: (studentId) =>
    api.get(`/fees/student/${studentId}`).then(r => r.data),

  // ── Payments ─────────────────────────────────────────────
  recordPayment: (payload) =>
    api.post('/fees/payments', payload).then(r => r.data),

  getInvoicePayments: (invoiceId) =>
    api.get(`/fees/payments/invoice/${invoiceId}`).then(r => r.data),

  getDailyCollection: (paymentDate) =>
    api.get('/fees/payments/daily', { params: { payment_date: paymentDate } }).then(r => r.data),

  // ── Summary ──────────────────────────────────────────────
  getSummary: (academicYearId) =>
    api.get('/fees/summary', { params: { academic_year_id: academicYearId } }).then(r => r.data),
}

export default feesApi
