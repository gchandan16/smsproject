// frontend/src/components/fees/InvoiceReceipt.jsx
// ─────────────────────────────────────────────────────────────
// Professional printable invoice/receipt component
// Used in ReceiptModal — drop-in replacement
// ─────────────────────────────────────────────────────────────

export function InvoiceReceipt({ receipt, student, invoice, schoolProfile }) {
  const school = schoolProfile || {}
  const schoolName = school.school_name || localStorage.getItem('school_name') || 'School Name'
  const address    = school.address    || {}
  const board      = school.board      || ''
  const phone      = school.phone      || ''
  const email      = school.email      || ''

  const paidAmt    = parseFloat(receipt?.amount      || 0)
  const totalAmt   = parseFloat(invoice?.total_amount || 0)
  const balanceAmt = parseFloat(invoice?.balance      || 0) - paidAmt
  const prevPaid   = parseFloat(invoice?.paid_amount  || 0)

  const METHOD_LABEL = {
    cash:          'Cash',
    upi:           'UPI / QR',
    bank_transfer: 'Bank Transfer',
    cheque:        'Cheque',
    dd:            'Demand Draft',
    online:        'Online',
  }

  const formatDate = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  }

  const fmt = (n) =>
    parseFloat(n || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    })

  return (
    <div id="printable-invoice" style={{
      fontFamily: 'Arial, sans-serif',
      fontSize: 13,
      color: '#1a1a1a',
      background: '#fff',
      width: '100%',
      maxWidth: 680,
    }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{
        background: '#1e3a5f',
        color: '#fff',
        padding: '20px 28px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}>
        {/* School info */}
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 0.3, marginBottom: 4 }}>
            {schoolName}
          </div>
          {board && (
            <div style={{ fontSize: 11, opacity: 0.75, marginBottom: 2 }}>{board}</div>
          )}
          {(address.street || address.city) && (
            <div style={{ fontSize: 11, opacity: 0.75 }}>
              {[address.street, address.city, address.state, address.pin]
                .filter(Boolean).join(', ')}
            </div>
          )}
          {phone && (
            <div style={{ fontSize: 11, opacity: 0.75 }}>Tel: {phone}</div>
          )}
          {email && (
            <div style={{ fontSize: 11, opacity: 0.75 }}>{email}</div>
          )}
        </div>

        {/* Receipt label */}
        <div style={{ textAlign: 'right' }}>
          <div style={{
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 6,
            padding: '6px 16px',
            marginBottom: 8,
          }}>
            <div style={{ fontSize: 11, opacity: 0.8, textTransform: 'uppercase', letterSpacing: 1 }}>
              Fee Receipt
            </div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{receipt?.receipt_no}</div>
          </div>
          <div style={{ fontSize: 11, opacity: 0.75 }}>
            Date: {formatDate(receipt?.payment_date)}
          </div>
        </div>
      </div>

      {/* ── Blue accent bar ─────────────────────────────────── */}
      <div style={{
        height: 4,
        background: 'linear-gradient(90deg, #1e3a5f 0%, #2e7d8c 50%, #22c55e 100%)',
      }} />

      {/* ── Student + Invoice info row ──────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 1,
        background: '#e5e7eb',
      }}>
        {/* Student */}
        <div style={{ background: '#f8fafc', padding: '14px 20px' }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: '#64748b',
            textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
          }}>
            Student Details
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
            {student?.first_name} {student?.last_name || ''}
          </div>
          <InfoRow label="Admission No" value={student?.admission_no} />
          {student?.current_section && (
            <InfoRow label="Class" value={student.current_section} />
          )}
        </div>

        {/* Invoice info */}
        <div style={{ background: '#f8fafc', padding: '14px 20px' }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: '#64748b',
            textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
          }}>
            Invoice Details
          </div>
          <InfoRow label="Invoice No"   value={invoice?.invoice_no} />
          <InfoRow label="Issue Date"   value={formatDate(invoice?.issue_date)} />
          <InfoRow label="Due Date"     value={formatDate(invoice?.due_date)} />
          <InfoRow label="Status" value={
            <span style={{
              background: invoice?.status === 'paid' ? '#dcfce7' : '#fef9c3',
              color:      invoice?.status === 'paid' ? '#15803d' : '#854d0e',
              padding: '1px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
            }}>
              {(invoice?.status || 'sent').toUpperCase()}
            </span>
          } />
        </div>
      </div>

      {/* ── Line items ─────────────────────────────────────── */}
      <div style={{ padding: '0 0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#1e3a5f', color: '#fff' }}>
              <th style={{ padding: '9px 20px', textAlign: 'left', fontSize: 11,
                fontWeight: 600, letterSpacing: 0.5, width: 40 }}>#</th>
              <th style={{ padding: '9px 12px', textAlign: 'left', fontSize: 11,
                fontWeight: 600, letterSpacing: 0.5 }}>Fee Description</th>
              <th style={{ padding: '9px 20px', textAlign: 'right', fontSize: 11,
                fontWeight: 600, letterSpacing: 0.5 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice?.items?.length > 0 ? (
              invoice.items.map((item, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <td style={{ padding: '9px 20px', color: '#94a3b8', fontSize: 12 }}>
                    {i + 1}
                  </td>
                  <td style={{ padding: '9px 12px', fontSize: 13 }}>
                    {item.description}
                  </td>
                  <td style={{ padding: '9px 20px', textAlign: 'right',
                    fontSize: 13, fontWeight: 500 }}>
                    ₹{fmt(item.amount)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} style={{ padding: '9px 20px', color: '#94a3b8', fontSize: 12 }}>
                  No items
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Totals ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        padding: '0 0 0 0',
        borderTop: '1px solid #e5e7eb',
      }}>
        <div style={{ width: 260, padding: '12px 20px' }}>
          <TotalRow label="Subtotal"    value={`₹${fmt(invoice?.subtotal || totalAmt)}`} />
          {parseFloat(invoice?.discount_amount || 0) > 0 && (
            <TotalRow label="Discount"
              value={`- ₹${fmt(invoice?.discount_amount)}`}
              color="#16a34a" />
          )}
          {parseFloat(invoice?.fine_amount || 0) > 0 && (
            <TotalRow label="Late Fine"
              value={`+ ₹${fmt(invoice?.fine_amount)}`}
              color="#dc2626" />
          )}
          <div style={{
            borderTop: '1px solid #e5e7eb',
            marginTop: 6, paddingTop: 6,
          }}>
            <TotalRow label="Total Amount"
              value={`₹${fmt(totalAmt)}`}
              bold />
          </div>
          {prevPaid > 0 && (
            <TotalRow label="Previously Paid"
              value={`₹${fmt(prevPaid)}`}
              color="#16a34a" />
          )}
        </div>
      </div>

      {/* ── Payment highlight box ───────────────────────────── */}
      <div style={{
        margin: '0 20px 16px',
        background: '#f0fdf4',
        border: '1.5px solid #86efac',
        borderRadius: 8,
        padding: '14px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>
            Amount Received
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#15803d' }}>
            ₹{fmt(paidAmt)}
          </div>
          <div style={{ fontSize: 12, color: '#166534', marginTop: 3 }}>
            via {METHOD_LABEL[receipt?.method] || receipt?.method || 'Cash'}
            {receipt?.reference_no && (
              <span style={{ color: '#64748b', marginLeft: 6 }}>
                · Ref: {receipt.reference_no}
              </span>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {balanceAmt > 0.01 ? (
            <>
              <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>
                Balance Remaining
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#dc2626' }}>
                ₹{fmt(Math.max(0, balanceAmt))}
              </div>
            </>
          ) : (
            <div style={{
              background: '#dcfce7', color: '#15803d',
              border: '1.5px solid #86efac', borderRadius: 6,
              padding: '8px 16px', fontWeight: 700, fontSize: 14,
            }}>
              ✓ FULLY PAID
            </div>
          )}
        </div>
      </div>

      {/* ── Remarks ────────────────────────────────────────── */}
      {receipt?.remarks && (
        <div style={{ margin: '0 20px 16px', padding: '10px 14px',
          background: '#f8fafc', borderRadius: 6, fontSize: 12, color: '#64748b' }}>
          <strong style={{ color: '#475569' }}>Remarks:</strong> {receipt.remarks}
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────── */}
      <div style={{
        borderTop: '1px solid #e5e7eb',
        padding: '14px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
      }}>
        <div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>
            This is a computer generated receipt. No signature required.
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
            Generated on {new Date().toLocaleString('en-IN')}
          </div>
        </div>
        {/* Signature block */}
        <div style={{ textAlign: 'right' }}>
          <div style={{
            width: 140, borderTop: '1px solid #94a3b8',
            paddingTop: 4, fontSize: 11, color: '#64748b',
          }}>
            Authorised Signatory
          </div>
        </div>
      </div>

      {/* ── Bottom accent ───────────────────────────────────── */}
      <div style={{
        height: 6,
        background: 'linear-gradient(90deg, #1e3a5f, #2e7d8c)',
      }} />
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between',
      alignItems: 'center', marginBottom: 4 }}>
      <span style={{ fontSize: 11, color: '#64748b' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>{value || '—'}</span>
    </div>
  )
}

function TotalRow({ label, value, bold, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between',
      alignItems: 'center', marginBottom: 4 }}>
      <span style={{ fontSize: 12, color: '#64748b' }}>{label}</span>
      <span style={{
        fontSize: bold ? 14 : 12,
        fontWeight: bold ? 700 : 500,
        color: color || (bold ? '#1a1a1a' : '#475569'),
      }}>
        {value}
      </span>
    </div>
  )
}

export default InvoiceReceipt
