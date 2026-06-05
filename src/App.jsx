import { useState, useEffect, useMemo } from "react";

// ─── SUPABASE CONFIG ───────────────────────────────────────────────────────────
const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_ANON_KEY";

async function sb(path, method = "GET", body = null) {
  const opts = {
    method,
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      "Prefer": method === "POST" ? "return=representation" : "",
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, opts);
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ─── SEED DATA ────────────────────────────────────────────────────────────────
const SEED_JOBS = [
  {id:1,asm:"A007529",so:"296966",customer:"Busch Ire",job_type:"Valve Overhaul",business_unit:"Industrial",owner:"Darragh",allocated_to:"Darragh",date_issued:"2025-11-20",due_date:"2025-11-28",est_hours:6,act_hours:6,status:"Complete",work_doc:"Work orders/A007529.pdf"},
  {id:2,asm:"A007527",so:"296966",customer:"Busch Ire",job_type:"Valve Assembly",business_unit:"Industrial",owner:"Darragh",allocated_to:"Darragh",date_issued:"2025-11-20",due_date:"2025-11-28",est_hours:2,act_hours:2,status:"Complete",work_doc:"Work orders/A007527.pdf"},
  {id:3,asm:"A007445",so:"296987",customer:"Aughinish",job_type:"Pump Overhaul",business_unit:"Mining",owner:"Darragh",allocated_to:"Darragh",date_issued:"2025-11-18",due_date:"2025-11-28",est_hours:4,act_hours:6,status:"Complete",work_doc:"Work orders/A007445.pdf"},
  {id:4,asm:"A007582",so:"297516",customer:"BMD",job_type:"Mechanical Seal Refurb",business_unit:"Pharma",owner:"Shauna",allocated_to:"Shauna",date_issued:"2025-11-22",due_date:"2026-01-02",est_hours:6,act_hours:3,status:"In Progress",work_doc:"Work orders/A007582.pdf"},
  {id:5,asm:"A007583",so:"297516",customer:"BMD",job_type:"Mechanical Seal Refurb",business_unit:"Pharma",owner:"Shauna",allocated_to:"Shauna",date_issued:"2025-11-22",due_date:"2026-01-02",est_hours:3,act_hours:null,status:"In Progress",work_doc:"Work orders/A007583.pdf"},
];

const SEED_NOTES = [
  {id:1,job_id:1,author:"Darragh",body:"Completed ahead of schedule.",created_at:"2025-11-28T09:14:00Z"},
];

// ─── CONSTANTS & HELPERS ──────────────────────────────────────────────────────
const TODAY = new Date("2026-06-03");
const COLORS = {
  navy:"#0B1F3A",orange:"#E8601A",steel:"#4A6380",steelLt:"#EDF2F7",
  mist:"#F59E0FA",rule:"#DDE3EC",text:"#1A2E44",textSoft:"#8099B5",
  green:"#0E7C4A",greenLt:"#E8F7EF",red:"#C0392B",redLt:"#FEF2F2",
};

const fd = (d) => !d ? "—" : new Date(d).toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric" });
const nowISO = () => new Date().toISOString();

// ─── COMPONENTS ──────────────────────────────────────────────────────────────
function Avatar({ name, size = 30 }) {
  return <div style={{width:size,height:size,borderRadius:"50%",background:COLORS.navy,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.4,fontWeight:800}}>{name?.[0]}</div>;
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState("jobs");
  const [jobs, setJobs] = useState(SEED_JOBS);
  const [notes, setNotes] = useState(SEED_NOTES);

  // Authentication Logic
  if (!authenticated) {
    return (
      <div style={{display:'flex',height:'100vh',alignItems:'center',justifyContent:'center',background:COLORS.mist}}>
        <div style={{padding:40,background:'white',borderRadius:12,boxShadow:'0 10px 30px rgba(0,0,0,0.1)',textAlign:'center'}}>
          <h2 style={{color:COLORS.navy,marginBottom:20}}>Flexachem Access</h2>
          <input type="password" placeholder="Enter Password" onChange={(e) => setPassword(e.target.value)} style={{padding:10,width:'100%',marginBottom:10,borderRadius:6,border:`1px solid ${COLORS.rule}`}}/>
          <button onClick={() => password === "flexachem2026" && setAuthenticated(true)} style={{background:COLORS.orange,color:'white',border:'none',padding:'10px 20px',borderRadius:6,cursor:'pointer',fontWeight:700,width:'100%'}}>Login</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{display: 'flex', height: '100vh', fontFamily: "'Mulish', sans-serif"}}>
      {/* Sidebar - Two Column Layout */}
      <aside style={{width: 260, background: COLORS.navy, color: 'white', padding: 24, display: 'flex', flexDirection: 'column'}}>
        <h2 style={{marginBottom: 40, letterSpacing: -1, fontSize: 18}}>Flexachem <span style={{color:COLORS.orange}}>Tracker</span></h2>
        <nav style={{display: 'flex', flexDirection: 'column', gap: 15, flex: 1}}>
          <button onClick={() => setTab("jobs")} style={{background: tab==="jobs" ? 'rgba(255,255,255,0.1)' : 'transparent', border:'none', color:'white', textAlign:'left', padding: 10, borderRadius: 6, cursor:'pointer'}}>📋 Work Orders</button>
          <button onClick={() => setTab("dash")} style={{background: tab==="dash" ? 'rgba(255,255,255,0.1)' : 'transparent', border:'none', color:'white', textAlign:'left', padding: 10, borderRadius: 6, cursor:'pointer'}}>📊 Dashboard</button>
        </nav>
        <button onClick={() => setAuthenticated(false)} style={{background:'transparent', border:'1px solid rgba(255,255,255,0.2)', color:'white', padding: 10, borderRadius: 6, cursor:'pointer'}}>Logout</button>
      </aside>

      {/* Main Content Area */}
      <main style={{flex: 1, overflow: 'auto', background: COLORS.mist, padding: 30}}>
        {tab === "jobs" && (
          <div>
            <h1 style={{color:COLORS.navy, marginBottom:20}}>Work Orders</h1>
            {jobs.map(j => (
              <div key={j.id} style={{background:'white', padding:15, marginBottom:10, borderRadius:8, display:'flex', justifyContent:'space-between', border:`1px solid ${COLORS.rule}`}}>
                <div><div style={{fontWeight:800}}>{j.asm}</div><div style={{fontSize:12, color:COLORS.textSoft}}>{j.customer}</div></div>
                <div style={{fontWeight:700, color:COLORS.orange}}>{j.status}</div>
              </div>
            ))}
          </div>
        )}
        {tab === "dash" && <h1>Dashboard Overview</h1>}
      </main>
    </div>
  );
}