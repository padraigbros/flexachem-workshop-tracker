import { useState, useMemo } from "react";

// ─── STYLES & CSS ─────────────────────────────────────────────────────────────
const globalCss = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: #F4F7FA; color: #1A2E44; }
  
  .app-header { background: #0B1F3A; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; color: white; position: sticky; top: 0; z-index: 10; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
  .header-title { font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }
  .header-title span { color: #E8601A; }
  
  .nav-tabs { display: flex; gap: 10px; padding: 15px 20px; background: white; border-bottom: 1px solid #DDE3EC; overflow-x: auto; }
  .tab-btn { padding: 8px 16px; border: none; background: transparent; color: #8099B5; font-weight: 600; cursor: pointer; border-radius: 20px; transition: all 0.2s; white-space: nowrap; }
  .tab-btn.active { background: #E8F7EF; color: #0E7C4A; }
  
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
  .status-complete { background: #E8F7EF; color: #0E7C4A; border-color: #bbf7d0; }
  .status-progress { background: #FFF4E5; color: #E8601A; border-color: #fed7aa; }
  
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

  /* Avatar */
  .avatar { width: 24px; height: 24px; border-radius: 50%; background: #4A6380; color: white; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; }
  .avatar-owner { background: #E8601A; }
`;

// ─── SUPABASE CONFIG (Placeholder from original) ──────────────────────────────
const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_ANON_KEY";

// ─── SEED DATA ────────────────────────────────────────────────────────────────
const SEED_JOBS = [
  {id:1,asm:"A007529",so:"296966",customer:"Busch Ire",job_type:"Valve Overhaul",business_unit:"Industrial",owner:"Darragh",allocated_to:"Darragh",date_issued:"2025-11-20",due_date:"2025-11-28",est_hours:6,act_hours:6,status:"Complete"},
  {id:2,asm:"A007527",so:"296966",customer:"Busch Ire",job_type:"Valve Assembly",business_unit:"Industrial",owner:"Darragh",allocated_to:"Darragh",date_issued:"2025-11-20",due_date:"2025-11-28",est_hours:2,act_hours:2,status:"Complete"},
  {id:3,asm:"A007445",so:"296987",customer:"Aughinish",job_type:"Pump Overhaul",business_unit:"Mining",owner:"Darragh",allocated_to:"Darragh",date_issued:"2025-11-18",due_date:"2025-11-28",est_hours:4,act_hours:6,status:"Complete"},
  {id:4,asm:"A007582",so:"297516",customer:"BMD",job_type:"Mechanical Seal",business_unit:"Pharma",owner:"Shauna",allocated_to:"Shauna",date_issued:"2025-11-22",due_date:"2026-01-02",est_hours:6,act_hours:8,status:"In Progress"},
  {id:5,asm:"A007583",so:"297516",customer:"BMD",job_type:"Mechanical Seal",business_unit:"Pharma",owner:"Shauna",allocated_to:"Shauna",date_issued:"2025-11-22",due_date:"2026-01-02",est_hours:3,act_hours:0,status:"In Progress"},
];

const SEED_NOTES = [
  {id:1,job_id:1,author:"Darragh",body:"Completed ahead of schedule."},
  {id:2,job_id:4,author:"Shauna",body:"Waiting on parts from supplier. Act hours running over estimate."},
];

const fd = (d) => !d ? "—" : new Date(d).toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric" });

// ─── COMPONENTS ──────────────────────────────────────────────────────────────
function Avatar({ name, isOwner }) {
  return <div className={`avatar ${isOwner ? 'avatar-owner' : ''}`}>{name ? name[0] : '?'}</div>;
}

function JobCard({ job, notesCount, onStatusChange }) {
  const isOverBudget = job.act_hours > job.est_hours;
  
  return (
    <div className="job-card">
      <div className="card-header">
        <div className="card-title-group">
          <span className="asm-number">{job.asm}</span>
          <span className="so-number">SO: {job.so}</span>
        </div>
        <select 
          value={job.status} 
          onChange={(e) => onStatusChange(job.id, e.target.value)}
          className={`status-select ${job.status === 'Complete' ? 'status-complete' : 'status-progress'}`}
        >
          <option value="In Progress">In Progress</option>
          <option value="Complete">Complete</option>
          <option value="Delayed">Delayed</option>
        </select>
      </div>

      <div className="card-tags">
        <span className="tag tag-customer">{job.customer}</span>
        <span className="tag">{job.job_type}</span>
        <span className="tag">{job.business_unit}</span>
      </div>

      <div className="card-details">
        <div className="detail-block">
          <span className="detail-label">Team</span>
          <span className="detail-value"><Avatar name={job.owner} isOwner /> {job.owner} (Owner)</span>
          <span className="detail-value"><Avatar name={job.allocated_to} /> {job.allocated_to} (Alloc)</span>
        </div>
        
        <div className="detail-block">
          <span className="detail-label">Timeline</span>
          <span className="detail-value">Issued: {fd(job.date_issued)}</span>
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
        <button className="btn-notes" onClick={() => alert(`Open notes for ${job.asm}`)}>
          💬 Notes {notesCount > 0 && <span style={{background:'#E8601A', color:'white', borderRadius:'10px', padding:'2px 6px', fontSize:'10px'}}>{notesCount}</span>}
        </button>
      </div>
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState("all");
  const [jobs, setJobs] = useState(SEED_JOBS);
  const [search, setSearch] = useState("");

  const updateStatus = (id, newStatus) => {
    setJobs(jobs.map(j => j.id === id ? { ...j, status: newStatus } : j));
  };

  const filteredJobs = useMemo(() => {
    let f = jobs;
    if (tab === "active") f = f.filter(j => j.status !== "Complete");
    if (search) f = f.filter(j => j.asm.toLowerCase().includes(search.toLowerCase()) || j.customer.toLowerCase().includes(search.toLowerCase()));
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

        {/* Navigation Tabs */}
        <div className="nav-tabs">
          <button className={`tab-btn ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab("all")}>All Jobs ({jobs.length})</button>
          <button className={`tab-btn ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab("active")}>Active ({jobs.filter(j => j.status !== 'Complete').length})</button>
        </div>

        {/* Main Content (Responsive Grid) */}
        <main className="main-content" style={{ flex: 1, overflowY: 'auto' }}>
          <div className="jobs-grid">
            {filteredJobs.map(j => (
              <JobCard 
                key={j.id} 
                job={j} 
                notesCount={SEED_NOTES.filter(n => n.job_id === j.id).length}
                onStatusChange={updateStatus}
              />
            ))}
          </div>
          {filteredJobs.length === 0 && <p style={{textAlign: 'center', marginTop: '40px', color: '#8099B5'}}>No jobs found matching your criteria.</p>}
        </main>

      </div>
    </>
  );
}