import { useState, useMemo, useEffect } from "react";

// ─── STYLES & CSS ─────────────────────────────────────────────────────────────
const globalCss = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: #F4F7FA; color: #1A2E44; }
  
  .app-header { background: #0B1F3A; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; color: white; position: sticky; top: 0; z-index: 10; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
  .header-title { font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }
  .header-title span { color: #E8601A; }
  
  .nav-tabs { display: flex; justify-content: space-between; align-items: center; padding: 10px 20px; background: white; border-bottom: 1px solid #DDE3EC; overflow-x: auto; gap: 15px; }
  .tabs-group { display: flex; gap: 10px; }
  .tab-btn { padding: 8px 16px; border: none; background: transparent; color: #8099B5; font-weight: 600; cursor: pointer; border-radius: 20px; transition: all 0.2s; white-space: nowrap; }
  .tab-btn.active { background: #E8F7EF; color: #0E7C4A; }
  
  .btn-primary { background: #E8601A; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 700; cursor: pointer; transition: opacity 0.2s; white-space: nowrap; }
  .btn-primary:hover { opacity: 0.9; }

  .main-content { padding: 20px; max-width: 1400px; margin: 0 auto; }
  
  /* Responsive Card Grid */
  .jobs-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
  @media (min-width: 768px) { .jobs-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (min-width: 1100px) { .jobs-grid { grid-template-columns: repeat(3, 1fr); } }
  
  /* Job Card Styling */
  .job-card { background: white; border-radius: 12px; border: 1px solid #DDE3EC; box-shadow: 0 2px 8px rgba(0,0,0,0.04); overflow: hidden; display: flex; flex-direction: column; transition: transform 0.2s, box-shadow 0.2s; }
  .job-card:hover { transform: translateY(-2px); box-shadow: 0 8px 16px rgba(0,0,0,0.08); border-color: #cbd5e1; }
  
  .card-header { padding: 16px; display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #F4F7FA; }
  .card-title-group { display: flex; flex-direction: column; }
  .asm-number { font-size: 18px; font-weight: 800; color: #0B1F3A; }
  .so-number { font-size: 12px; color: #8099B5; font-weight: 600; margin-top: 2px; }
  
  .status-select { padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; border: 1px solid transparent; outline: none; cursor: pointer; appearance: auto; }
  .status-Complete { background: #E8F7EF; color: #0E7C4A; border-color: #bbf7d0; }
  .status-InProgress { background: #FFF4E5; color: #E8601A; border-color: #fed7aa; }
  .status-InputNeeded { background: #FEF2F2; color: #C0392B; border-color: #fecaca; }
  
  .card-tags { padding: 12px 16px; display: flex; flex-wrap: wrap; gap: 8px; background: #fafafa; border-bottom: 1px solid #F4F7FA; }
  .tag { padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; background: #EDF2F7; color: #4A6380; }
  .tag-customer { background: #0B1F3A; color: white; }
  
  .card-details { padding: 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 15px; flex: 1; }
  .detail-block { display: flex; flex-direction: column; gap: 4px; }
  .detail-label { font-size: 11px; text-transform: uppercase; color: #8099B5; font-weight: 700; letter-spacing: 0.5px; }
  .detail-value { font-size: 13px; color: #1A2E44; font-weight: 500; display: flex; align-items: center; gap: 6px; }
  .variance-high { color: #C0392B; font-weight: 700; }
  
  .card-footer { padding: 12px 16px; border-top: 1px solid #DDE3EC; display: flex; justify-content: flex-end; background: #fff; }
  .btn-notes { display: flex; align-items: center; gap: 6px; padding: 8px 16px; background: #F4F7FA; border: 1px solid #DDE3EC; border-radius: 8px; color: #1A2E44; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
  .btn-notes:hover { background: #EDF2F7; }

  .avatar { width: 24px; height: 24px; border-radius: 50%; background: #4A6380; color: white; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; }
  .avatar-owner { background: #E8601A; }

  /* Modals */
  .modal-overlay { position: fixed; inset: 0; background: rgba(11,31,58,0.7); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 15px; backdrop-filter: blur(2px); }
  .modal-card { background: white; border-radius: 12px; width: 100%; max-width: 600px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.2); }
  .modal-header { padding: 16px 20px; background: #0B1F3A; color: white; display: flex; justify-content: space-between; align-items: center; font-weight: 700; }
  .modal-close { background: rgba(255,255,255,0.2); border: none; color: white; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-weight: bold; }
  .modal-body { padding: 20px; overflow-y: auto; flex: 1; }
  
  /* Form Elements */
  .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
  .form-group { display: flex; flex-direction: column; gap: 6px; }
  .form-group.full { grid-column: 1 / -1; }
  .form-label { font-size: 11px; font-weight: 700; color: #8099B5; text-transform: uppercase; }
  .form-input, .form-select, .form-textarea { padding: 10px 12px; border: 1px solid #DDE3EC; border-radius: 6px; font-family: inherit; font-size: 13px; outline: none; background: #F4F7FA; color: #1A2E44; }
  .form-input:focus, .form-select:focus, .form-textarea:focus { border-color: #E8601A; background: #fff; }
  .form-textarea { resize: vertical; min-height: 80px; }
  
  /* Notes Area */
  .note-item { background: #F4F7FA; border-left: 3px solid #E8601A; padding: 12px; border-radius: 0 8px 8px 0; margin-bottom: 12px; }
  .note-meta { display: flex; justify-content: space-between; font-size: 11px; color: #8099B5; margin-bottom: 6px; font-weight: 600; }
  .note-body { font-size: 13px; line-height: 1.4; }
`;

// ─── CONSTANTS & DATA ─────────────────────────────────────────────────────────
const JOB_TYPES = ["Site Work", "Valve Assembly", "Pump Assembly", "Valve Overhaul", "Pump Overhaul", "Mechanical Seal Refurb", "Testing"];
const BUSINESS_UNITS = ["Pharma", "Industrial", "Mining", "Engineering", "Other"];
const PEOPLE = ["Darragh", "Shauna", "Cathal", "Ross", "Dave", "Colin"];
const STATUSES = ["In Progress", "Input Needed", "Complete"];

const SEED_JOBS = [
  {id:1,asm:"A007529",so:"296966",customer:"Busch Ire",job_type:"Valve Overhaul",business_unit:"Industrial",owner:"Darragh",allocated_to:"Darragh",date_issued:"2025-11-20",due_date:"2025-11-28",est_hours:6,act_hours:6,status:"Complete"},
  {id:2,asm:"A007582",so:"297516",customer:"BMD",job_type:"Mechanical Seal Refurb",business_unit:"Pharma",owner:"Shauna",allocated_to:"Shauna",date_issued:"2025-11-22",due_date:"2026-01-02",est_hours:6,act_hours:8,status:"In Progress"},
];

const SEED_NOTES = [
  {id:1,job_id:1,author:"Darragh",body:"Completed ahead of schedule. Passed testing.",created_at:new Date().toISOString()},
];

const fd = (d) => !d ? "—" : new Date(d).toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric" });
const statusClass = (s) => s === "In Progress" ? "status-InProgress" : s === "Input Needed" ? "status-InputNeeded" : "status-Complete";

// ─── COMPONENTS ──────────────────────────────────────────────────────────────
function Avatar({ name, isOwner }) {
  return <div className={`avatar ${isOwner ? 'avatar-owner' : ''}`}>{name ? name[0] : '?'}</div>;
}

function JobCard({ job, notesCount, onStatusChange, onOpenNotes }) {
  const isOverBudget = job.act_hours > job.est_hours;
  
  return (
    <div className="job-card">
      <div className="card-header">
        <div className="card-title-group">
          <span className="asm-number">{job.asm || 'No ASM'}</span>
          <span className="so-number">SO: {job.so || 'N/A'}</span>
        </div>
        <select 
          value={job.status} 
          onChange={(e) => onStatusChange(job.id, e.target.value)}
          className={`status-select ${statusClass(job.status)}`}
        >
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="card-tags">
        <span className="tag tag-customer">{job.customer || 'Unknown Customer'}</span>
        <span className="tag">{job.job_type}</span>
        <span className="tag">{job.business_unit}</span>
      </div>

      <div className="card-details">
        <div className="detail-block">
          <span className="detail-label">Team</span>
          <span className="detail-value"><Avatar name={job.owner} isOwner /> {job.owner} (Own)</span>
          <span className="detail-value"><Avatar name={job.allocated_to} /> {job.allocated_to} (Alloc)</span>
        </div>
        
        <div className="detail-block">
          <span className="detail-label">Timeline</span>
          <span className="detail-value">Iss: {fd(job.date_issued)}</span>
          <span className="detail-value">Due: {fd(job.due_date)}</span>
        </div>

        <div className="detail-block" style={{ gridColumn: '1 / -1', borderTop: '1px dashed #DDE3EC', paddingTop: '10px' }}>
          <span className="detail-label">Hours Tracking</span>
          <span className="detail-value" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <span>Est: {job.est_hours || 0} hrs</span>
            <span className={isOverBudget ? 'variance-high' : ''}>
              Act: {job.act_hours || 0} hrs {isOverBudget && "⚠️"}
            </span>
          </span>
        </div>
      </div>

      <div className="card-footer">
        <button className="btn-notes" onClick={() => onOpenNotes(job)}>
          💬 Notes {notesCount > 0 && <span style={{background:'#E8601A', color:'white', borderRadius:'10px', padding:'2px 6px', fontSize:'10px'}}>{notesCount}</span>}
        </button>
      </div>
    </div>
  );
}

// ─── MODALS ──────────────────────────────────────────────────────────────────
function JobModal({ onSave, onClose }) {
  const [form, setForm] = useState({
    asm: "", so: "", customer: "", job_type: JOB_TYPES[0], business_unit: BUSINESS_UNITS[0], 
    owner: PEOPLE[0], allocated_to: PEOPLE[0], date_issued: "", due_date: "", est_hours: "", act_hours: "", status: "In Progress", work_doc: ""
  });

  const update = (field, val) => setForm(f => ({ ...f, [field]: val }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span>Add New Work Order</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group"><label className="form-label">ASM Number</label><input className="form-input" value={form.asm} onChange={e=>update('asm', e.target.value)} placeholder="e.g. A007123"/></div>
            <div className="form-group"><label className="form-label">Sales Order</label><input className="form-input" value={form.so} onChange={e=>update('so', e.target.value)} placeholder="e.g. 296000"/></div>
            <div className="form-group full"><label className="form-label">Customer</label><input className="form-input" value={form.customer} onChange={e=>update('customer', e.target.value)}/></div>
            
            <div className="form-group">
              <label className="form-label">Job Type</label>
              <select className="form-select" value={form.job_type} onChange={e=>update('job_type', e.target.value)}>
                {JOB_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Business Unit</label>
              <select className="form-select" value={form.business_unit} onChange={e=>update('business_unit', e.target.value)}>
                {BUSINESS_UNITS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Owner</label>
              <select className="form-select" value={form.owner} onChange={e=>update('owner', e.target.value)}>
                {PEOPLE.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Allocated To</label>
              <select className="form-select" value={form.allocated_to} onChange={e=>update('allocated_to', e.target.value)}>
                {PEOPLE.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>

            <div className="form-group"><label className="form-label">Date Issued</label><input type="date" className="form-input" value={form.date_issued} onChange={e=>update('date_issued', e.target.value)}/></div>
            <div className="form-group"><label className="form-label">Due Date</label><input type="date" className="form-input" value={form.due_date} onChange={e=>update('due_date', e.target.value)}/></div>

            <div className="form-group"><label className="form-label">Est Hours</label><input type="number" className="form-input" value={form.est_hours} onChange={e=>update('est_hours', e.target.value)}/></div>
            <div className="form-group"><label className="form-label">Act Hours</label><input type="number" className="form-input" value={form.act_hours} onChange={e=>update('act_hours', e.target.value)}/></div>
          </div>
          <div style={{marginTop: '20px', display: 'flex', justifyContent: 'flex-end'}}>
            <button className="btn-primary" onClick={() => { onSave({...form, id: Date.now()}); onClose(); }}>Save Work Order</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotesModal({ job, notes, onAddNote, onClose }) {
  const [newNote, setNewNote] = useState("");
  const jobNotes = notes.filter(n => n.job_id === job.id).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{maxWidth: '500px'}}>
        <div className="modal-header">
          <span>Notes: {job.asm}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{background: '#fff'}}>
          <div style={{marginBottom: '20px'}}>
            <textarea className="form-textarea" style={{width: '100%', marginBottom: '10px'}} placeholder="Add an update from the floor..." value={newNote} onChange={e => setNewNote(e.target.value)}></textarea>
            <button className="btn-primary" style={{width: '100%'}} onClick={() => { if(newNote.trim()) { onAddNote(job.id, newNote); setNewNote(""); }}}>Post Note</button>
          </div>
          
          <div>
            {jobNotes.length === 0 ? <p style={{textAlign:'center', color:'#8099B5', fontSize:'13px'}}>No notes yet.</p> : null}
            {jobNotes.map(n => (
              <div key={n.id} className="note-item">
                <div className="note-meta">
                  <span>{n.author}</span>
                  <span>{new Date(n.created_at).toLocaleString("en-IE", {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'})}</span>
                </div>
                <div className="note-body">{n.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  
  // Modals state
  const [isAddJobOpen, setIsAddJobOpen] = useState(false);
  const [activeNotesJob, setActiveNotesJob] = useState(null);

  // Persistence wrapper for state
  const [jobs, setJobs] = useState(() => {
    const saved = localStorage.getItem('flexachem_jobs');
    return saved ? JSON.parse(saved) : SEED_JOBS;
  });
  
  const [notes, setNotes] = useState(() => {
    const saved = localStorage.getItem('flexachem_notes');
    return saved ? JSON.parse(saved) : SEED_NOTES;
  });

  // Sync to local storage
  useEffect(() => { localStorage.setItem('flexachem_jobs', JSON.stringify(jobs)); }, [jobs]);
  useEffect(() => { localStorage.setItem('flexachem_notes', JSON.stringify(notes)); }, [notes]);

  // Actions
  const updateStatus = (id, newStatus) => {
    setJobs(jobs.map(j => j.id === id ? { ...j, status: newStatus } : j));
  };

  const addJob = (newJob) => {
    setJobs([newJob, ...jobs]);
  };

  const addNote = (jobId, body) => {
    const newNote = { id: Date.now(), job_id: jobId, author: "Service Tech", body: body, created_at: new Date().toISOString() };
    setNotes([...notes, newNote]);
  };

  // Filtering
  const filteredJobs = useMemo(() => {
    let f = jobs;
    if (tab === "active") f = f.filter(j => j.status !== "Complete");
    if (search) f = f.filter(j => j.asm?.toLowerCase().includes(search.toLowerCase()) || j.customer?.toLowerCase().includes(search.toLowerCase()));
    return f;
  }, [jobs, tab, search]);

  if (!authenticated) {
    return (
      <div style={{display:'flex',height:'100vh',alignItems:'center',justifyContent:'center',background:'#0B1F3A', fontFamily:'Inter, sans-serif'}}>
        <div style={{padding:40,background:'white',borderRadius:16,boxShadow:'0 10px 25px rgba(0,0,0,0.5)',width:'100%',maxWidth:360,textAlign:'center'}}>
          <h2 style={{color:'#0B1F3A',marginBottom:30,fontSize:24}}>Flexachem<span style={{color:'#E8601A'}}>Tracker</span></h2>
          <input type="password" placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} style={{width:'100%',padding:12,marginBottom:20,borderRadius:8,border:'1px solid #cbd5e1',outline:'none',fontSize:16,boxSizing:'border-box'}}/>
          <button onClick={() => password === "flexachem2026" && setAuthenticated(true)} style={{width:'100%',background:'#E8601A',color:'white',border:'none',padding:14,borderRadius:8,fontSize:16,fontWeight:600,cursor:'pointer'}}>Login</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: globalCss}} />
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        
        {/* Header */}
        <header className="app-header">
          <div className="header-title">Flexachem <span>Tracker</span></div>
          <input 
            type="text" 
            placeholder="Search ASM or Customer..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', outline: 'none', width: '250px' }}
          />
          <button onClick={() => setAuthenticated(false)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>Logout</button>
        </header>

        {/* Navigation Tabs & Actions */}
        <div className="nav-tabs">
          <div className="tabs-group">
            <button className={`tab-btn ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab("all")}>All Jobs ({jobs.length})</button>
            <button className={`tab-btn ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab("active")}>Active ({jobs.filter(j => j.status !== 'Complete').length})</button>
          </div>
          <button className="btn-primary" onClick={() => setIsAddJobOpen(true)}>＋ New Job</button>
        </div>

        {/* Main Content (Responsive Grid) */}
        <main className="main-content" style={{ flex: 1, overflowY: 'auto', width: '100%' }}>
          <div className="jobs-grid">
            {filteredJobs.map(j => (
              <JobCard 
                key={j.id} 
                job={j} 
                notesCount={notes.filter(n => n.job_id === j.id).length}
                onStatusChange={updateStatus}
                onOpenNotes={setActiveNotesJob}
              />
            ))}
          </div>
          {filteredJobs.length === 0 && <p style={{textAlign: 'center', marginTop: '40px', color: '#8099B5'}}>No jobs found matching your criteria.</p>}
        </main>
      </div>

      {/* Render Modals if open */}
      {isAddJobOpen && <JobModal onSave={addJob} onClose={() => setIsAddJobOpen(false)} />}
      {activeNotesJob && <NotesModal job={activeNotesJob} notes={notes} onAddNote={addNote} onClose={() => setActiveNotesJob(null)} />}
    </>
  );
}