export default function Footer() {
  return (
    <footer className="app-footer">
      <div className="float-end d-none d-sm-inline">Version 1.0.0</div>
      <strong>School Management System</strong> &copy; {new Date().getFullYear()}
    </footer>
  )
}
