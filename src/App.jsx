import { useState, useMemo } from "react";

// ─── RESPONSIVE CSS INJECTION ────────────────────────────────────────────────
const globalCss = `
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: #f8fafc; color: #0f172a; }
  
  .app-container { display: flex; height: 100vh; flex-direction: column; }
  .sidebar { width: 100%; background: #0B1F3A; display: flex; overflow-x: auto; padding: 10px 20px; align-items: center; justify-content: space-between; flex-shrink: 0; }
  .sidebar-nav { display: flex; gap: 10px; }
  .sidebar-brand { font-size: 18px; font-weight: 700; color: white; margin: 0; display: flex; align-items: center; }
  .sidebar-brand span { color: #E8601A; margin-left: 5px; }
  
  .main-content { flex: 1; overflow-y: auto; padding: 20px; }
  .top-bar { display: flex; flex-direction: column; gap: 15px; margin-bottom: 20px; }
  .search-input { width: 100%; padding: 10px 15px; border: 1px solid #cbd5e1; border-radius: 8px; outline: none; transition: border-color 0.2s; }
  .search-input:focus { border-color: #E8601A; }
  
  /* Job Grid / Card Hybrid */
  .job-list { display: flex; flex-direction: column; gap: 12px; }
  .job-row-header { display: none; }
  .job-item { background: white; padding: 16px; border-radius: 10px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex; flex-direction: column; gap: 12px; transition: transform 0.1s, box-shadow 0.1s; }
  .job-item:hover { box-shadow: 0 4px 6px rgba(0,0,0,0.05); transform: translateY(-1px); }
  
  .data-group { display: flex; flex-direction: column; gap: 4px; }
  .label-mobile { font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 600; letter-spacing: 0.5px; }
  .val-primary { font-weight: 600; color: #0f172a; }
  .val-secondary { font-size: 13px; color: #64748b; }
  
  .status-badge { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
  .status-complete { background: #dcfce7; color: #166534; }
  .status-progress { background: #fef08a; color: #854d0e; }
  
  .btn { cursor: pointer; padding: 8px 12px; border-radius: 6px; border: none; font-weight: 600; transition: opacity 0.2s; }
  .btn:hover { opacity: 0.8; }
  .btn-nav { background: transparent; color: #cbd5e1; font-weight: 500; }
  .btn-nav.active { background: rgba(255,255,255,0.1); color: white; }
  .btn-action { background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0; }

  /* Desktop Adjustments */
  @media (min-width: 1024px) {
    .app-container { flex-direction: row; }
    .sidebar { width: 260px; flex-direction: column; justify-content: flex-start; align-items: flex-start; padding: 30px 20px; }
    .sidebar-nav { flex-direction: column; width: 100%; margin-top: 40px; }
    .sidebar-brand { margin-bottom: 20px; }
    .btn-nav { text-align: left; padding: 12px 15px; }
    
    .main-content { padding: 40px; }
    .top-bar { flex-direction: row; justify-content: space-between; align-items: center; }
    .search-input { width: 350px; }
    
    .job-row-header { display: grid; grid-template-columns: 2fr 1.5fr 1.5fr 1.5fr 1fr 80px; gap: 15px; padding: 0 16px 12px 16px; border-bottom: 2px solid #e2e8f0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .job-item { flex-direction: row; display: grid; grid-template-columns: 2fr 1.5fr 1.5fr 1.5fr 1fr 80px; gap: 15px; align-items: center; padding: 12px 16px; }
    .label-mobile { display: none; }
  }

  /* Modal Styles */
  .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15,23,42,0.6); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 50; backdrop-filter: blur(2px); }
  .modal-content { background: white; width: 100%; max-width: 500px; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); display: flex; flex-direction: column; max-height: 85vh; }
  .modal-header { padding: 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
  .modal-body { padding: 20px; overflow-y: auto; flex: 1; }
`;

// ─── SEED DATA (From Original App.jsx) ────────────────────────────────────────
const SEED_JOBS = [
  {id:1,asm:"A007529",so:"296966",customer:"Busch Ire",job_type:"Valve Overhaul",business_unit:"Industrial",owner:"Darragh",allocated_to:"Darragh",date_issued:"2025-11-20",due_date:"2025-11-28",est_hours:6,act_hours:6,status:"Complete"},
  {id:2,asm:"A007527",so:"296966",customer:"Busch Ire",job_type:"Valve Assembly",business_unit:"Industrial",owner:"Darragh",allocated_to:"Darragh",date_issued:"2025-11-20",due_date:"2025-11-28",est_hours:2,act_hours:2,status:"Complete"},
  {id:3,asm:"A007445",so:"296987",customer:"Aughinish",job_type:"Pump Overhaul",business_unit:"Mining",owner:"Darragh",allocated_to:"Darragh",date_issued:"2025-11-18",due_date:"2025-11-28",est_hours:4,act_hours:6,status:"Complete"},
  {id:4,asm:"A007582",so:"297516",customer:"BMD",job_type:"Mechanical Seal",business_unit:"Pharma",owner:"Shauna",allocated_to:"Shauna",date_issued:"2025-11-22",due_date:"2026-01-02",est_hours:6,act_hours:3,status:"In Progress"},
  {id:5,asm:"A007583",so:"297516",customer:"BMD",job_type:"Mechanical Seal",business_unit:"Pharma",owner:"Shauna",allocated_to:"Shauna",date_issued:"2025-11-22",due_date:"2026-01-02",est_hours:3,act_hours:0,status:"In Progress"},
];

const SEED_NOTES = [
  {id:1,job_id:1,author:"Darragh",body:"Completed ahead of schedule. Parts sourced locally.",created_at:"2025-11-28T09:14:00Z"},
];

const fd = (d) => !d ? "—" : new Date(d).toLocaleDateString("en-IE", { day: "2-digit", month: "short" });

// ─── COMPONENTS ────────────────────────────────────────────────────────────────

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState("jobs");
  const [search, setSearch] = useState("");
  const [activeNotesJob, setActiveNotesJob] = useState(null);

  // Filter Jobs
  const filteredJobs = useMemo(() => {
    return SEED_JOBS.filter(j => 
      j.asm.toLowerCase().includes(search.toLowerCase()) || 
      j.customer.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  // Auth Guard
  if (!authenticated) {
    return (
      <div style={{display:'flex',height:'100vh',alignItems:'center',justifyContent:'center',background:'#e2e8f0', fontFamily:'Inter, sans-serif'}}>
        <div style={{padding:40,background:'white',borderRadius:16,boxShadow:'0 10px 25px rgba(0,0,0,0.05)',width:'100%',maxWidth:400,textAlign:'center'}}>
          <h2 style={{color:'#0B1F3A',marginBottom:30,fontSize:24}}>Flexachem<span style={{color:'#E8601A'}}>Tracker</span></h2>
          <input type="password" placeholder="Enter secure password" onChange={(e) => setPassword(e.target.value)} style={{width:'100%',padding:12,marginBottom:20,borderRadius:8,border:'1px solid #cbd5e1',outline:'none',fontSize:16}}/>
          <button onClick={() => password === "flexachem2026" && setAuthenticated(true)} style={{width:'100%',background:'#E8601A',color:'white',border:'none',padding:14,borderRadius:8,fontSize:16,fontWeight:600,cursor:'pointer'}}>Sign In</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: globalCss}} />
      
      <div className="app-container">
        {/* Sidebar / Top Nav */}
        <aside className="sidebar">
          <h1 className="sidebar-brand">Flexachem <span>Tracker</span></h1>
          <nav className="sidebar-nav">
            <button className={`btn btn-nav ${tab === 'jobs' ? 'active' : ''}`} onClick={() => setTab("jobs")}>📋 Work Orders</button>
            <button className={`btn btn-nav ${tab === 'dash' ? 'active' : ''}`} onClick={() => setTab("dash")}>📊 Dashboard</button>
            <button className="btn btn-nav" onClick={() => setAuthenticated(false)} style={{marginTop: 'auto'}}>🚪 Logout</button>
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="main-content">
          <div className="top-bar">
            <h2 style={{margin: 0, fontSize: 24, color: '#0B1F3A'}}>{tab === 'jobs' ? 'Active Work Orders' : 'System Dashboard'}</h2>
            {tab === 'jobs' && (
              <input type="text" className="search-input" placeholder="Search ASM or Customer..." value={search} onChange={e => setSearch(e.target.value)} />
            )}
          </div>

          {tab === 'jobs' && (
            <div className="job-list">
              <div className="job-row-header">
                <div>Project Details</div>
                <div>Job Type & Unit</div>
                <div>Team (Own / Alloc)</div>
                <div>Dates & Hours</div>
                <div>Status</div>
                <div style={{textAlign:'center'}}>Notes</div>
              </div>

              {filteredJobs.map(j => (
                <div key={j.id} className="job-item">
                  <div className="data-group">
                    <span className="label-mobile">Project Details</span>
                    <span className="val-primary">{j.asm} <span style={{color:'#94a3b8',fontWeight:400}}>| {j.so}</span></span>
                    <span className="val-secondary">{j.customer}</span>
                  </div>

                  <div className="data-group">
                    <span className="label-mobile">Type & Unit</span>
                    <span className="val-primary">{j.job_type}</span>
                    <span className="val-secondary">{j.business_unit}</span>
                  </div>

                  <div className="data-group">
                    <span className="label-mobile">Team</span>
                    <span className="val-primary">{j.owner}</span>
                    <span className="val-secondary">Alloc: {j.allocated_to}</span>
                  </div>

                  <div className="data-group">
                    <span className="label-mobile">Metrics</span>
                    <span className="val-primary">Due: {fd(j.due_date)}</span>
                    <span className="val-secondary" style={{color: j.act_hours > j.est_hours ? '#dc2626' : '#64748b'}}>
                      {j.est_hours}h est / {j.act_hours}h act
                    </span>
                  </div>

                  <div className="data-group">
                    <span className="status-badge" style={{background: j.status === 'Complete' ? '#dcfce7' : '#f1f5f9', color: j.status === 'Complete' ? '#166534' : '#334155'}}>
                      {j.status}
                    </span>
                  </div>

                  <div className="data-group" style={{alignItems: 'center'}}>
                    <button className="btn btn-action" onClick={() => setActiveNotesJob(j)}>💬</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'dash' && (
             <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(250px, 1fr))', gap:20}}>
               <div style={{background:'white', padding:20, borderRadius:12, border:'1px solid #e2e8f0'}}>
                 <h3 style={{margin:'0 0 10px 0', color:'#64748b', fontSize:14, textTransform:'uppercase'}}>Total Workload</h3>
                 <div style={{fontSize:32, fontWeight:700, color:'#0B1F3A'}}>{SEED_JOBS.reduce((acc, j) => acc + j.est_hours, 0)} <span style={{fontSize:16, fontWeight:400, color:'#94a3b8'}}>est hours</span></div>
               </div>
             </div>
          )}
        </main>
      </div>

      {/* Notes Modal */}
      {activeNotesJob && (
        <div className="modal-overlay" onClick={() => setActiveNotesJob(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{margin:0}}>Notes: {activeNotesJob.asm}</h3>
              <button className="btn" onClick={() => setActiveNotesJob(null)} style={{background:'transparent', fontSize:20}}>×</button>
            </div>
            <div className="modal-body">
              {SEED_NOTES.filter(n => n.job_id === activeNotesJob.id).map(n => (
                <div key={n.id} style={{background:'#f8fafc', padding:15, borderRadius:8, marginBottom:10, border:'1px solid #e2e8f0'}}>
                  <div style={{display:'flex', justifyContent:'space-between', marginBottom:8, fontSize:12, color:'#64748b'}}>
                    <strong>{n.author}</strong>
                    <span>{new Date(n.created_at).toLocaleDateString()}</span>
                  </div>
                  <div style={{fontSize:14}}>{n.body}</div>
                </div>
              ))}
              {SEED_NOTES.filter(n => n.job_id === activeNotesJob.id).length === 0 && <p style={{color:'#94a3b8', textAlign:'center'}}>No notes yet.</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}