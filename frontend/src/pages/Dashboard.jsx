export default function Dashboard() {
  const stats = [
    { label: 'Total Students', value: '1,240', icon: 'bi-people-fill',    color: 'primary' },
    { label: 'Total Staff',    value: '86',    icon: 'bi-person-badge',   color: 'success' },
    { label: 'Fee Collected',  value: '₹4.2L', icon: 'bi-cash-coin',      color: 'warning' },
    { label: 'Attendance',     value: '92%',   icon: 'bi-calendar-check', color: 'danger'  },
  ]

  return (
    <>
      {/* Page Header */}
      <div className="d-flex align-items-center mb-4">
        <div>
          <h4 className="fw-bold mb-0">Dashboard</h4>
          <small className="text-muted">Welcome back, Admin</small>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="row g-3 mb-4">
        {stats.map(s => (
          <div key={s.label} className="col-12 col-sm-6 col-xl-3">
            <div className={`card border-0 shadow-sm border-start border-${s.color} border-4`}>
              <div className="card-body d-flex align-items-center justify-content-between">
                <div>
                  <div className="text-muted small mb-1">{s.label}</div>
                  <div className="fs-4 fw-bold">{s.value}</div>
                </div>
                <div className={`bg-${s.color} bg-opacity-10 rounded-circle p-3`}>
                  <i className={`bi ${s.icon} fs-4 text-${s.color}`}></i>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="row g-3 mb-4">
        <div className="col-12">
          <div className="card shadow-sm border-0">
            <div className="card-header bg-white fw-semibold">Quick Actions</div>
            <div className="card-body d-flex flex-wrap gap-2">
              <button className="btn btn-primary btn-sm">
                <i className="bi bi-person-plus me-1"></i>Add Student
              </button>
              <button className="btn btn-success btn-sm">
                <i className="bi bi-calendar-plus me-1"></i>Mark Attendance
              </button>
              <button className="btn btn-warning btn-sm">
                <i className="bi bi-receipt me-1"></i>Generate Fee Invoice
              </button>
              <button className="btn btn-info btn-sm text-white">
                <i className="bi bi-file-earmark-bar-graph me-1"></i>View Reports
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Students Table */}
      <div className="row g-3">
        <div className="col-12 col-lg-7">
          <div className="card shadow-sm border-0">
            <div className="card-header bg-white d-flex justify-content-between align-items-center">
              <span className="fw-semibold">Recent Admissions</span>
              <a href="/students" className="btn btn-sm btn-outline-primary">View All</a>
            </div>
            <div className="card-body p-0">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Name</th><th>Class</th><th>Date</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: 'Aarav Sharma',  cls: '10-A', date: '20 May', status: 'Active' },
                    { name: 'Priya Patel',   cls: '9-B',  date: '19 May', status: 'Active' },
                    { name: 'Rohit Verma',   cls: '8-C',  date: '18 May', status: 'Pending' },
                    { name: 'Sneha Gupta',   cls: '11-A', date: '17 May', status: 'Active' },
                  ].map(s => (
                    <tr key={s.name}>
                      <td>{s.name}</td>
                      <td>{s.cls}</td>
                      <td>{s.date}</td>
                      <td>
                        <span className={`badge bg-${s.status === 'Active' ? 'success' : 'warning'}`}>
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Fee Summary */}
        <div className="col-12 col-lg-5">
          <div className="card shadow-sm border-0">
            <div className="card-header bg-white fw-semibold">Fee Collection This Month</div>
            <div className="card-body">
              {[
                { label: 'Collected', value: 68, color: 'success', amount: '₹2.85L' },
                { label: 'Pending',   value: 22, color: 'warning', amount: '₹0.92L' },
                { label: 'Overdue',   value: 10, color: 'danger',  amount: '₹0.43L' },
              ].map(f => (
                <div key={f.label} className="mb-3">
                  <div className="d-flex justify-content-between mb-1">
                    <span className="small">{f.label}</span>
                    <span className="small fw-semibold">{f.amount}</span>
                  </div>
                  <div className="progress" style={{ height: 8 }}>
                    <div
                      className={`progress-bar bg-${f.color}`}
                      style={{ width: `${f.value}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
