// frontend/src/pages/LibraryPage.jsx
import { useState, useEffect, useCallback } from 'react'
import api from '../api/client.js'

const toast = (setter, msg, ms=3000) => { setter(msg); setTimeout(()=>setter(''), ms) }
function Spinner(){ return <div className="text-center py-5"><div className="spinner-border text-primary"></div></div> }
function ErrBox({msg}){ return msg ? <div className="alert alert-danger py-2 small"><i className="bi bi-exclamation-triangle-fill me-2"></i>{msg}</div> : null }
function OkBox({msg}){ return msg ? <div className="alert alert-success py-2 small"><i className="bi bi-check-circle-fill me-2"></i>{msg}</div> : null }

export default function LibraryPage() {
  const [tab, setTab] = useState('dashboard')
  return (
    <div>
      <div className="mb-4">
        <h4 className="fw-bold mb-0">Library</h4>
        <small className="text-muted">Manage books, members and issue/return transactions</small>
      </div>
      <ul className="nav nav-tabs mb-4">
        {[
          { key:'dashboard', icon:'bi-speedometer2', label:'Overview' },
          { key:'books',     icon:'bi-book',         label:'Books'    },
          { key:'members',   icon:'bi-people-fill',  label:'Members'  },
          { key:'issues',    icon:'bi-journal-arrow-up', label:'Issue / Return' },
        ].map(t=>(
          <li key={t.key} className="nav-item">
            <button className={`nav-link ${tab===t.key?'active':''}`} onClick={()=>setTab(t.key)}>
              <i className={`bi ${t.icon} me-2`}></i>{t.label}
            </button>
          </li>
        ))}
      </ul>
      {tab==='dashboard' && <DashboardTab />}
      {tab==='books'     && <BooksTab />}
      {tab==='members'   && <MembersTab />}
      {tab==='issues'    && <IssuesTab />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  DASHBOARD
// ─────────────────────────────────────────────────────────────
function DashboardTab() {
  const [s, setS] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/library/summary').then(r=>setS(r.data)).catch(()=>setS({})).finally(()=>setLoading(false))
  },[])

  if (loading) return <Spinner />

  const cards = [
    { label:'Total Books',    val:s?.total_books||0,     icon:'bi-book',           c1:'#1e3a5f', c2:'#e8f0fe' },
    { label:'Available',      val:s?.available_books||0, icon:'bi-check-circle',   c1:'#16a34a', c2:'#dcfce7' },
    { label:'Issued',         val:s?.issued_books||0,    icon:'bi-journal-arrow-up',c1:'#0369a1', c2:'#e0f2fe' },
    { label:'Overdue',        val:s?.overdue_books||0,   icon:'bi-exclamation-triangle', c1:'#dc2626', c2:'#fee2e2' },
    { label:'Members',        val:s?.total_members||0,   icon:'bi-people-fill',    c1:'#7c3aed', c2:'#ede9fe' },
  ]

  return (
    <div className="row g-3">
      {cards.map(c=>(
        <div key={c.label} className="col-6 col-md">
          <div className="card border-0 shadow-sm h-100" style={{background:c.c2}}>
            <div className="card-body py-3">
              <div className="d-flex align-items-start justify-content-between">
                <div>
                  <div style={{fontSize:11,textTransform:'uppercase',letterSpacing:.5}} className="text-muted fw-medium mb-1">{c.label}</div>
                  <div className="fw-bold" style={{fontSize:26,color:c.c1}}>{c.val}</div>
                </div>
                <div style={{width:36,height:36,borderRadius:10,background:c.c1,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <i className={`bi ${c.icon} text-white`} style={{fontSize:15}}></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  BOOKS TAB
// ─────────────────────────────────────────────────────────────
function BooksTab() {
  const [books, setBooks]   = useState([])
  const [cats,  setCats]    = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [err,setErr]=useState(''); const [ok,setOk]=useState('')
  const [showCatForm, setShowCatForm] = useState(false)
  const [newCat, setNewCat] = useState('')

  const BLANK = { title:'', author:'', isbn:'', category_id:'', publisher:'',
    edition:'', publish_year:'', rack_no:'', total_copies:1, price:0, is_active:true }
  const [form, setForm] = useState(BLANK)

  const load = useCallback(async () => {
    const params = {}
    if (search) params.search = search
    if (filterCat) params.category_id = filterCat
    try {
      const [b,c] = await Promise.all([
        api.get('/library/books',{params}).then(r=>r.data),
        api.get('/library/categories').then(r=>r.data),
      ])
      setBooks(Array.isArray(b)?b:[])
      setCats(Array.isArray(c)?c:[])
    } catch(e){ setErr(e.response?.data?.detail||'Failed to load books') }
    setLoading(false)
  },[search,filterCat])

  useEffect(()=>{ const t=setTimeout(load,300); return ()=>clearTimeout(t) },[load])

  const openAdd=()=>{ setEditing(null); setForm(BLANK); setErr(''); setShowForm(true) }
  const openEdit=(b)=>{
    setEditing(b)
    setForm({ title:b.title, author:b.author||'', isbn:b.isbn||'',
      category_id:b.category_id||'', publisher:b.publisher||'', edition:b.edition||'',
      publish_year:b.publish_year||'', rack_no:b.rack_no||'',
      total_copies:b.total_copies, price:b.price, is_active:b.is_active })
    setErr(''); setShowForm(true)
  }

  const save=async(e)=>{
    e.preventDefault()
    if(!form.title.trim()){setErr('Title is required');return}
    setSaving(true); setErr('')
    try{
      const payload={...form, category_id:form.category_id||null,
        publish_year: form.publish_year===''?null:parseInt(form.publish_year),
        total_copies: parseInt(form.total_copies)||1, price: parseFloat(form.price)||0}
      if(editing) await api.put(`/library/books/${editing.id}`,payload)
      else        await api.post('/library/books',payload)
      setShowForm(false)
      toast(setOk, editing?'✓ Book updated':'✓ Book added')
      await load()
    }catch(e){ setErr(e.response?.data?.detail||'Save failed') }
    finally{ setSaving(false) }
  }

  const del=async(b)=>{
    if(!window.confirm(`Delete "${b.title}"?`))return
    try{ await api.delete(`/library/books/${b.id}`); await load(); toast(setOk,'✓ Deleted') }
    catch(e){ setErr(e.response?.data?.detail||'Delete failed') }
  }

  const saveCat=async()=>{
    if(!newCat.trim())return
    try{
      await api.post('/library/categories',{name:newCat.trim()})
      setNewCat(''); setShowCatForm(false)
      await load()
    }catch(e){ setErr(e.response?.data?.detail||'Failed') }
  }

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-white">
        <div className="row g-2 align-items-center">
          <div className="col-md-4">
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-light"><i className="bi bi-search"></i></span>
              <input className="form-control" placeholder="Search title, author, ISBN..."
                value={search} onChange={e=>setSearch(e.target.value)} />
            </div>
          </div>
          <div className="col-md-3">
            <select className="form-select form-select-sm" value={filterCat} onChange={e=>setFilterCat(e.target.value)}>
              <option value="">All Categories</option>
              {cats.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="col-auto">
            <button className="btn btn-outline-secondary btn-sm" onClick={()=>setShowCatForm(s=>!s)}>
              <i className="bi bi-tag me-1"></i>Categories
            </button>
          </div>
          <div className="col-auto ms-auto">
            <span className="badge bg-secondary me-2">{books.length} books</span>
            <button className="btn btn-primary btn-sm" onClick={openAdd}><i className="bi bi-plus-lg me-1"></i>Add Book</button>
          </div>
        </div>
      </div>

      {showCatForm && (
        <div className="card-body bg-light border-bottom py-2">
          <div className="d-flex gap-2 align-items-center flex-wrap">
            <span className="small fw-medium text-muted">Categories:</span>
            {cats.map(c=>(
              <span key={c.id} className="badge bg-white border text-dark">{c.name}</span>
            ))}
            <input className="form-control form-control-sm" style={{maxWidth:160}}
              placeholder="New category" value={newCat} onChange={e=>setNewCat(e.target.value)}
              onKeyDown={e=>e.key==='Enter' && saveCat()} />
            <button className="btn btn-sm btn-success" onClick={saveCat}><i className="bi bi-plus"></i></button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="card-body bg-light border-bottom">
          <div className="fw-medium small text-muted mb-2">{editing?'Edit Book':'New Book'}</div>
          <form onSubmit={save}>
            <div className="row g-2">
              <div className="col-md-5">
                <label className="form-label fw-medium small mb-1">Title *</label>
                <input className="form-control form-control-sm" value={form.title} required
                  onChange={e=>setForm(f=>({...f,title:e.target.value}))} />
              </div>
              <div className="col-md-4">
                <label className="form-label fw-medium small mb-1">Author</label>
                <input className="form-control form-control-sm" value={form.author}
                  onChange={e=>setForm(f=>({...f,author:e.target.value}))} />
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium small mb-1">ISBN</label>
                <input className="form-control form-control-sm" value={form.isbn}
                  onChange={e=>setForm(f=>({...f,isbn:e.target.value}))} />
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium small mb-1">Category</label>
                <select className="form-select form-select-sm" value={form.category_id}
                  onChange={e=>setForm(f=>({...f,category_id:e.target.value}))}>
                  <option value="">-- None --</option>
                  {cats.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label fw-medium small mb-1">Publisher</label>
                <input className="form-control form-control-sm" value={form.publisher}
                  onChange={e=>setForm(f=>({...f,publisher:e.target.value}))} />
              </div>
              <div className="col-md-2">
                <label className="form-label fw-medium small mb-1">Edition</label>
                <input className="form-control form-control-sm" value={form.edition}
                  onChange={e=>setForm(f=>({...f,edition:e.target.value}))} />
              </div>
              <div className="col-md-2">
                <label className="form-label fw-medium small mb-1">Year</label>
                <input type="number" className="form-control form-control-sm" value={form.publish_year}
                  onChange={e=>setForm(f=>({...f,publish_year:e.target.value}))} />
              </div>
              <div className="col-md-2">
                <label className="form-label fw-medium small mb-1">Rack No</label>
                <input className="form-control form-control-sm" value={form.rack_no}
                  onChange={e=>setForm(f=>({...f,rack_no:e.target.value}))} />
              </div>
              <div className="col-md-2">
                <label className="form-label fw-medium small mb-1">Total Copies</label>
                <input type="number" className="form-control form-control-sm" min="1" value={form.total_copies}
                  onChange={e=>setForm(f=>({...f,total_copies:e.target.value}))} />
              </div>
              <div className="col-md-2">
                <label className="form-label fw-medium small mb-1">Price ₹</label>
                <input type="number" className="form-control form-control-sm" min="0" value={form.price}
                  onChange={e=>setForm(f=>({...f,price:e.target.value}))} />
              </div>
              <div className="col-12"><ErrBox msg={err} /></div>
              <div className="col-12 d-flex gap-2">
                <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                  {saving?'Saving...':editing?'Update Book':'Add Book'}
                </button>
                <button type="button" className="btn btn-light btn-sm" onClick={()=>{setShowForm(false);setErr('')}}>Cancel</button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="card-body p-0">
        <OkBox msg={ok} />
        {!showForm&&<ErrBox msg={err} />}
        {loading?<Spinner/>:books.length===0?(
          <div className="text-center py-5 text-muted"><i className="bi bi-book fs-1 d-block mb-2 opacity-25"></i><h6>No books found</h6></div>
        ):(
          <div className="table-responsive">
            <table className="table table-sm table-hover align-middle mb-0">
              <thead className="table-light">
                <tr><th>Title</th><th>Author</th><th>Category</th><th>Rack</th>
                  <th className="text-center">Total</th><th className="text-center">Available</th>
                  <th className="text-center">Issued</th><th style={{width:90}}></th></tr>
              </thead>
              <tbody>
                {books.map(b=>(
                  <tr key={b.id} className={!b.is_active?'opacity-50':''}>
                    <td>
                      <div className="fw-medium small">{b.title}</div>
                      {b.isbn&&<code className="text-muted" style={{fontSize:10}}>{b.isbn}</code>}
                    </td>
                    <td className="small">{b.author||'—'}</td>
                    <td>{b.category_name?<span className="badge bg-light text-dark border small">{b.category_name}</span>:'—'}</td>
                    <td className="text-muted small">{b.rack_no||'—'}</td>
                    <td className="text-center small">{b.total_copies}</td>
                    <td className="text-center">
                      <span className={`badge ${b.available_copies>0?'bg-success':'bg-danger'} small`}>{b.available_copies}</span>
                    </td>
                    <td className="text-center small text-muted">{b.issued_copies}</td>
                    <td>
                      <div className="btn-group btn-group-sm">
                        <button className="btn btn-outline-primary" onClick={()=>openEdit(b)}><i className="bi bi-pencil"></i></button>
                        <button className="btn btn-outline-danger" onClick={()=>del(b)}><i className="bi bi-trash"></i></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  MEMBERS TAB
// ─────────────────────────────────────────────────────────────
function MembersTab() {
  const [members,setMembers]=useState([])
  const [loading,setLoading]=useState(true)
  const [search,setSearch]=useState('')
  const [showForm,setShowForm]=useState(false)
  const [saving,setSaving]=useState(false)
  const [err,setErr]=useState(''); const [ok,setOk]=useState('')
  const [students,setStudents]=useState([])
  const [teachers,setTeachers]=useState([])
  const [selStudent,setSelStudent]=useState(null)
  const [form,setForm]=useState({member_type:'student',student_id:'',teacher_id:'',card_no:'',max_books:3,is_active:true})

  const load=useCallback(async()=>{
    const params={}
    if(search)params.search=search
    try{
      const m=await api.get('/library/members',{params}).then(r=>r.data)
      setMembers(Array.isArray(m)?m:[])
    }catch(e){setErr(e.response?.data?.detail||'Failed to load')}
    setLoading(false)
  },[search])

  useEffect(()=>{const t=setTimeout(load,300);return()=>clearTimeout(t)},[load])
  useEffect(()=>{
    api.get('/teachers').then(r=>setTeachers(Array.isArray(r.data)?r.data.filter(t=>t.is_active):[])).catch(()=>{})
  },[])

  const searchStudents=async(q)=>{
    if(q.length<2){setStudents([]);return}
    const r=await api.get('/students/',{params:{search:q,limit:10}}).then(r=>r.data).catch(()=>null)
    setStudents(Array.isArray(r?.students)?r.students:[])
  }

  const openAdd=()=>{
    setForm({member_type:'student',student_id:'',teacher_id:'',card_no:'',max_books:3,is_active:true})
    setSelStudent(null); setStudents([]); setErr(''); setShowForm(true)
  }

  const save=async()=>{
    if(!form.card_no.trim()){setErr('Card No is required');return}
    if(form.member_type==='student'&&!form.student_id){setErr('Select a student');return}
    if(form.member_type==='staff'&&!form.teacher_id){setErr('Select a teacher');return}
    setSaving(true); setErr('')
    try{
      await api.post('/library/members',form)
      setShowForm(false)
      toast(setOk,'✓ Member added')
      await load()
    }catch(e){setErr(e.response?.data?.detail||'Save failed')}
    finally{setSaving(false)}
  }

  const del=async(m)=>{
    if(!window.confirm(`Remove member "${m.name}"?`))return
    try{await api.delete(`/library/members/${m.id}`);await load();toast(setOk,'✓ Removed')}
    catch(e){setErr(e.response?.data?.detail||'Delete failed')}
  }

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-white d-flex justify-content-between align-items-center">
        <div className="input-group input-group-sm" style={{maxWidth:280}}>
          <span className="input-group-text bg-light"><i className="bi bi-search"></i></span>
          <input className="form-control" placeholder="Search members..."
            value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
        <div>
          <span className="badge bg-secondary me-2">{members.length} members</span>
          <button className="btn btn-primary btn-sm" onClick={openAdd}><i className="bi bi-person-plus-fill me-1"></i>Add Member</button>
        </div>
      </div>

      {showForm && (
        <div className="card-body bg-light border-bottom">
          <div className="fw-medium small text-muted mb-2">New Library Member</div>
          <div className="row g-3">
            <div className="col-md-3">
              <label className="form-label fw-medium small">Member Type</label>
              <select className="form-select" value={form.member_type}
                onChange={e=>setForm(f=>({...f,member_type:e.target.value,student_id:'',teacher_id:''}))}>
                <option value="student">Student</option>
                <option value="staff">Staff</option>
              </select>
            </div>
            {form.member_type==='student'?(
              <div className="col-md-5">
                <label className="form-label fw-medium small">Search Student *</label>
                <input className="form-control" placeholder="Type name or admission no..."
                  onChange={e=>searchStudents(e.target.value)} />
                {students.length>0&&(
                  <div className="border rounded mt-1" style={{maxHeight:140,overflowY:'auto'}}>
                    {students.map(s=>(
                      <button key={s.id} type="button"
                        className={`w-100 text-start border-0 px-3 py-2 small ${form.student_id===s.id?'bg-primary text-white':'bg-white'}`}
                        onClick={()=>{setSelStudent(s);setForm(f=>({...f,student_id:s.id}));setStudents([])}}>
                        {s.first_name} {s.last_name||''} <code style={{fontSize:10}}>{s.admission_no}</code>
                      </button>
                    ))}
                  </div>
                )}
                {selStudent&&<div className="small text-success mt-1"><i className="bi bi-check-circle me-1"></i>{selStudent.first_name} {selStudent.last_name}</div>}
              </div>
            ):(
              <div className="col-md-5">
                <label className="form-label fw-medium small">Staff *</label>
                <select className="form-select" value={form.teacher_id} onChange={e=>setForm(f=>({...f,teacher_id:e.target.value}))}>
                  <option value="">Select staff</option>
                  {teachers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}
            <div className="col-md-2">
              <label className="form-label fw-medium small">Card No *</label>
              <input className="form-control" placeholder="LIB-001" value={form.card_no}
                onChange={e=>setForm(f=>({...f,card_no:e.target.value}))} />
            </div>
            <div className="col-md-2">
              <label className="form-label fw-medium small">Max Books</label>
              <input type="number" className="form-control" min="1" value={form.max_books}
                onChange={e=>setForm(f=>({...f,max_books:parseInt(e.target.value)||3}))} />
            </div>
          </div>
          <ErrBox msg={err} />
          <div className="d-flex gap-2 mt-2">
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving?'Saving...':'Add Member'}</button>
            <button className="btn btn-light btn-sm" onClick={()=>{setShowForm(false);setErr('')}}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card-body p-0">
        <OkBox msg={ok} />
        {!showForm&&<ErrBox msg={err} />}
        {loading?<Spinner/>:members.length===0?(
          <div className="text-center py-5 text-muted"><i className="bi bi-people fs-1 d-block mb-2 opacity-25"></i><h6>No members yet</h6></div>
        ):(
          <table className="table table-sm table-hover align-middle mb-0">
            <thead className="table-light">
              <tr><th>Card No</th><th>Name</th><th>Type</th><th className="text-center">Books Held</th><th className="text-center">Limit</th><th className="text-center">Status</th><th style={{width:60}}></th></tr>
            </thead>
            <tbody>
              {members.map(m=>(
                <tr key={m.id} className={!m.is_active?'opacity-50':''}>
                  <td><code className="fw-bold">{m.card_no}</code></td>
                  <td className="fw-medium small">{m.name} {m.identifier!=='Staff'&&<code className="text-muted ms-1" style={{fontSize:10}}>{m.identifier}</code>}</td>
                  <td><span className="badge bg-light text-dark border small text-capitalize">{m.member_type}</span></td>
                  <td className="text-center small">
                    <span className={m.books_held>=m.max_books?'text-danger fw-bold':''}>{m.books_held}</span>
                  </td>
                  <td className="text-center small">{m.max_books}</td>
                  <td className="text-center">{m.is_active?<span className="badge bg-success small">Active</span>:<span className="badge bg-secondary small">Inactive</span>}</td>
                  <td><button className="btn btn-outline-danger btn-sm" onClick={()=>del(m)}><i className="bi bi-trash"></i></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  ISSUE / RETURN TAB
// ─────────────────────────────────────────────────────────────
function IssuesTab() {
  const [issues,setIssues]=useState([])
  const [books,setBooks]=useState([])
  const [members,setMembers]=useState([])
  const [loading,setLoading]=useState(true)
  const [filter,setFilter]=useState('issued')
  const [showForm,setShowForm]=useState(false)
  const [saving,setSaving]=useState(false)
  const [err,setErr]=useState(''); const [ok,setOk]=useState('')
  const [form,setForm]=useState({book_id:'',member_id:'',due_date:''})

  const load=useCallback(async()=>{
    const params={}
    if(filter)params.status=filter
    try{
      const [i,b,m]=await Promise.all([
        api.get('/library/issues',{params}).then(r=>r.data),
        api.get('/library/books').then(r=>r.data),
        api.get('/library/members').then(r=>r.data),
      ])
      setIssues(Array.isArray(i)?i:[])
      setBooks(Array.isArray(b)?b.filter(x=>x.available_copies>0):[])
      setMembers(Array.isArray(m)?m.filter(x=>x.is_active):[])
    }catch(e){setErr(e.response?.data?.detail||'Failed to load')}
    setLoading(false)
  },[filter])

  useEffect(()=>{load()},[load])

  const openAdd=()=>{
    const due=new Date();due.setDate(due.getDate()+14)
    setForm({book_id:'',member_id:'',due_date:due.toISOString().slice(0,10)})
    setErr(''); setShowForm(true)
  }

  const issue=async()=>{
    if(!form.book_id||!form.member_id){setErr('Select book and member');return}
    setSaving(true); setErr('')
    try{
      await api.post('/library/issues',form)
      setShowForm(false)
      toast(setOk,'✓ Book issued successfully')
      await load()
    }catch(e){setErr(e.response?.data?.detail||'Issue failed')}
    finally{setSaving(false)}
  }

  const returnBook=async(i)=>{
    const fine = i.calc_fine>0 ? `\n\nFine: ₹${i.calc_fine} (${i.days_overdue} days overdue)` : ''
    if(!window.confirm(`Return "${i.book_title}"?${fine}`))return
    try{
      await api.put(`/library/issues/${i.id}/return`,{fine_paid:i.calc_fine===0})
      await load()
      toast(setOk, i.calc_fine>0?`✓ Returned — Fine: ₹${i.calc_fine}`:'✓ Returned')
    }catch(e){setErr(e.response?.data?.detail||'Return failed')}
  }

  return (
    <div className="card border-0 shadow-sm">
      <div className="card-header bg-white d-flex justify-content-between align-items-center">
        <div className="btn-group btn-group-sm">
          {[
            {v:'issued',label:'Issued'},
            {v:'returned',label:'Returned'},
            {v:'',label:'All'},
          ].map(f=>(
            <button key={f.v} className={`btn ${filter===f.v?'btn-primary':'btn-outline-secondary'}`}
              onClick={()=>setFilter(f.v)}>{f.label}</button>
          ))}
        </div>
        <button className="btn btn-primary btn-sm" onClick={openAdd}><i className="bi bi-journal-plus me-1"></i>Issue Book</button>
      </div>

      {showForm && (
        <div className="card-body bg-light border-bottom">
          <div className="fw-medium small text-muted mb-2">Issue a Book</div>
          <div className="row g-3">
            <div className="col-md-5">
              <label className="form-label fw-medium small">Book *</label>
              <select className="form-select" value={form.book_id} onChange={e=>setForm(f=>({...f,book_id:e.target.value}))}>
                <option value="">Select book</option>
                {books.map(b=><option key={b.id} value={b.id}>{b.title} ({b.available_copies} available)</option>)}
              </select>
            </div>
            <div className="col-md-5">
              <label className="form-label fw-medium small">Member *</label>
              <select className="form-select" value={form.member_id} onChange={e=>setForm(f=>({...f,member_id:e.target.value}))}>
                <option value="">Select member</option>
                {members.map(m=>(
                  <option key={m.id} value={m.id} disabled={m.books_held>=m.max_books}>
                    {m.card_no} — {m.name} ({m.books_held}/{m.max_books})
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label fw-medium small">Due Date</label>
              <input type="date" className="form-control" value={form.due_date}
                onChange={e=>setForm(f=>({...f,due_date:e.target.value}))} />
            </div>
          </div>
          <ErrBox msg={err} />
          <div className="d-flex gap-2 mt-2">
            <button className="btn btn-primary btn-sm" onClick={issue} disabled={saving}>{saving?'Issuing...':'Issue Book'}</button>
            <button className="btn btn-light btn-sm" onClick={()=>{setShowForm(false);setErr('')}}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card-body p-0">
        <OkBox msg={ok} />
        {!showForm&&<ErrBox msg={err} />}
        {loading?<Spinner/>:issues.length===0?(
          <div className="text-center py-5 text-muted"><i className="bi bi-journal-arrow-up fs-1 d-block mb-2 opacity-25"></i><h6>No records found</h6></div>
        ):(
          <table className="table table-sm table-hover align-middle mb-0">
            <thead className="table-light">
              <tr><th>Book</th><th>Member</th><th>Issue Date</th><th>Due Date</th><th>Return Date</th><th>Fine</th><th>Status</th><th style={{width:80}}></th></tr>
            </thead>
            <tbody>
              {issues.map(i=>(
                <tr key={i.id} className={i.status==='overdue'?'table-danger':''}>
                  <td>
                    <div className="fw-medium small">{i.book_title}</div>
                    <div className="text-muted" style={{fontSize:10}}>{i.book_author}</div>
                  </td>
                  <td><code className="small">{i.card_no}</code> {i.member_name}</td>
                  <td className="small text-muted">{i.issue_date}</td>
                  <td className="small text-muted">{i.due_date}</td>
                  <td className="small text-muted">{i.return_date||'—'}</td>
                  <td>
                    {i.status==='returned'
                      ?(i.fine_amount>0?<span className="small">₹{i.fine_amount} {i.fine_paid?<span className="badge bg-success ms-1" style={{fontSize:9}}>Paid</span>:<span className="badge bg-warning text-dark ms-1" style={{fontSize:9}}>Due</span>}</span>:'—')
                      :(i.calc_fine>0?<span className="small text-danger fw-bold">₹{i.calc_fine}</span>:'—')}
                  </td>
                  <td>
                    {i.status==='issued'&&<span className="badge bg-primary small">Issued</span>}
                    {i.status==='overdue'&&<span className="badge bg-danger small">Overdue ({i.days_overdue}d)</span>}
                    {i.status==='returned'&&<span className="badge bg-success small">Returned</span>}
                  </td>
                  <td>
                    {(i.status==='issued'||i.status==='overdue')&&(
                      <button className="btn btn-outline-success btn-sm" onClick={()=>returnBook(i)}>
                        <i className="bi bi-arrow-return-left"></i> Return
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
