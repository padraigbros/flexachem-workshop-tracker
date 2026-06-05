import { useState, useEffect, useMemo, useRef } from "react";

// ─── SUPABASE CONFIG ───────────────────────────────────────────────────────────
// Replace these with your actual Supabase project values
const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_ANON_KEY";

// Supabase REST helper
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
  {id:6,asm:"A007584",so:"297516",customer:"BMD",job_type:"Testing",business_unit:"Pharma",owner:"Shauna",allocated_to:"Shauna",date_issued:"2025-11-22",due_date:"2026-01-02",est_hours:1,act_hours:null,status:"Input Needed",work_doc:"Work orders/A007584.pdf"},
  {id:7,asm:"A007585",so:"297516",customer:"BMD",job_type:"Testing",business_unit:"Pharma",owner:"Shauna",allocated_to:"Shauna",date_issued:"2025-11-22",due_date:"2026-01-02",est_hours:1,act_hours:null,status:"Input Needed",work_doc:"Work orders/A007585.pdf"},
  {id:8,asm:"A007563",so:"296767",customer:"MSD",job_type:"Valve Assembly",business_unit:"Pharma",owner:"Darragh",allocated_to:"Darragh",date_issued:"2025-11-25",due_date:"2026-01-07",est_hours:18,act_hours:8,status:"In Progress",work_doc:"Work orders/A007563.pdf"},
  {id:9,asm:"A007564",so:"296767",customer:"MSD",job_type:"Valve Assembly",business_unit:"Pharma",owner:"Darragh",allocated_to:"Darragh",date_issued:"2025-11-25",due_date:"2026-01-07",est_hours:7,act_hours:4,status:"In Progress",work_doc:"Work orders/A007564.pdf"},
  {id:10,asm:"A007528",so:"296966",customer:"Busch Ire",job_type:"Pump Assembly",business_unit:"Industrial",owner:"Darragh",allocated_to:"Darragh",date_issued:"2025-11-25",due_date:"2025-11-28",est_hours:10,act_hours:10,status:"Complete",work_doc:"Work orders/A007528.pdf"},
  {id:11,asm:"A007471",so:"296754",customer:"BCD Engineering",job_type:"Valve Overhaul",business_unit:"Engineering",owner:"Shauna",allocated_to:"Shauna",date_issued:"2025-11-10",due_date:"2025-11-28",est_hours:4,act_hours:5,status:"Complete",work_doc:"Work orders/A007471.pdf"},
  {id:12,asm:"A07427",so:"297068",customer:"European Refresh",job_type:"Valve Assembly",business_unit:"Industrial",owner:"Shauna",allocated_to:"Shauna",date_issued:"2025-11-24",due_date:"2025-12-05",est_hours:2,act_hours:null,status:"In Progress",work_doc:"Work orders/A007427.pdf"},
  {id:13,asm:"A007587",so:"297522",customer:"Eli Lilly",job_type:"Site Visit",business_unit:"Pharma",owner:"Cathal",allocated_to:"Cathal",date_issued:"2025-11-22",due_date:"2025-11-28",est_hours:1,act_hours:1,status:"Complete",work_doc:"Work orders/A007587.pdf"},
  {id:14,asm:"A007595",so:"297527",customer:"Jacobs",job_type:"Pump Overhaul",business_unit:"Engineering",owner:"Cathal",allocated_to:"Cathal",date_issued:"2025-11-24",due_date:"2025-11-28",est_hours:1,act_hours:1,status:"Complete",work_doc:"Work orders/A007595.pdf"},
  {id:15,asm:"A007613",so:"296819",customer:"MSD Ballydine",job_type:"Valve Assembly",business_unit:"Pharma",owner:"Darragh",allocated_to:"Darragh",date_issued:"2025-11-28",due_date:"2025-12-05",est_hours:2,act_hours:null,status:"In Progress",work_doc:"Work orders/A007613.pdf"},
  {id:16,asm:"A007615",so:"296819",customer:"MSD Ballydine",job_type:"Valve Assembly",business_unit:"Pharma",owner:"Darragh",allocated_to:"Darragh",date_issued:"2025-11-28",due_date:"2025-12-05",est_hours:2,act_hours:null,status:"In Progress",work_doc:"Work orders/A007615.pdf"},
  {id:17,asm:"A007616",so:"297155",customer:"MSD Ballydine",job_type:"Valve Overhaul",business_unit:"Pharma",owner:"Darragh",allocated_to:"Darragh",date_issued:"2025-11-28",due_date:"2026-01-15",est_hours:1,act_hours:null,status:"In Progress",work_doc:"Work orders/A007616.pdf"},
  {id:18,asm:"A007618",so:"297155",customer:"MSD Ballydine",job_type:"Pump Overhaul",business_unit:"Pharma",owner:"Darragh",allocated_to:"Dave",date_issued:"2025-11-28",due_date:"2026-01-15",est_hours:4,act_hours:null,status:"Input Needed",work_doc:"Work orders/A007618.pdf"},
  {id:19,asm:"A007623",so:"297080",customer:"EES",job_type:"Mechanical Seal Refurb",business_unit:"Industrial",owner:"Ross",allocated_to:"Ross",date_issued:"2025-12-01",due_date:"2025-12-05",est_hours:0.5,act_hours:0.5,status:"Complete",work_doc:"Work orders/A007623.pdf"},
  {id:20,asm:"A007405",so:"296889",customer:"Eli Lilly",job_type:"Valve Overhaul",business_unit:"Pharma",owner:"Darragh",allocated_to:"Colin",date_issued:"2025-11-20",due_date:"2025-12-12",est_hours:6,act_hours:2,status:"In Progress",work_doc:"Work orders/A007405.pdf"},
  {id:21,asm:"SITE-001",so:"TBA",customer:"Aughinish",job_type:"Site Visit",business_unit:"Mining",owner:"Darragh",allocated_to:"Colin",date_issued:"2025-12-01",due_date:"2026-04-01",est_hours:8,act_hours:null,status:"In Progress",work_doc:""},
  {id:22,asm:"SITE-002",so:"TBA",customer:"Astrazeneca",job_type:"Site Visit",business_unit:"Pharma",owner:"Darragh",allocated_to:"Dave",date_issued:"2025-12-01",due_date:"2026-01-01",est_hours:16,act_hours:null,status:"In Progress",work_doc:""},
  {id:23,asm:"SITE-003",so:"TBA",customer:"MSD Balline",job_type:"Site Visit",business_unit:"Pharma",owner:"Darragh",allocated_to:"Dave",date_issued:"2025-11-28",due_date:"2025-12-31",est_hours:4,act_hours:null,status:"Input Needed",work_doc:""},
  {id:24,asm:"SITE-004",so:"TBA",customer:"Eli Lilly Limerick",job_type:"Site Visit",business_unit:"Pharma",owner:"Cathal",allocated_to:"Colin",date_issued:"2025-12-08",due_date:"2026-01-15",est_hours:4,act_hours:null,status:"In Progress",work_doc:""},
  {id:25,asm:"A007509",so:"295768",customer:"Astrazeneca",job_type:"Pump Assembly",business_unit:"Pharma",owner:"Darragh",allocated_to:"Darragh",date_issued:"2025-10-15",due_date:"2025-11-14",est_hours:2,act_hours:2,status:"Complete",work_doc:"Work orders/A007509.pdf"},
];

const SEED_NOTES = [
  {id:1,job_id:1,author:"Darragh",body:"Completed ahead of schedule. Passed all pressure and leak tests.",created_at:"2025-11-28T09:14:00Z"},
  {id:2,job_id:2,author:"Darragh",body:"All pressure tests passed. Shipped to site.",created_at:"2025-11-28T11:00:00Z"},
  {id:3,job_id:3,author:"Darragh",body:"Extra time on bearing replacement — seating was heavily corroded.",created_at:"2025-11-27T14:30:00Z"},
  {id:4,job_id:3,author:"Darragh",body:"Complete. Actual 6h vs 4h estimated. Noted on work order.",created_at:"2025-11-28T15:00:00Z"},
  {id:5,job_id:4,author:"Shauna",body:"Seal lapping complete. Awaiting test bench slot — bench is booked Fri.",created_at:"2025-12-02T10:20:00Z"},
  {id:6,job_id:5,author:"Shauna",body:"Parts cleaned and inspected, ready for assembly.",created_at:"2025-12-01T08:55:00Z"},
  {id:7,job_id:6,author:"Shauna",body:"Test specification not yet received from BMD. Chasing their engineering contact.",created_at:"2025-12-03T16:00:00Z"},
  {id:8,job_id:7,author:"Shauna",body:"Waiting on customer drawing revision B before proceeding.",created_at:"2025-12-03T16:05:00Z"},
  {id:9,job_id:8,author:"Darragh",body:"Valve bodies machined. Actuator installation is next step.",created_at:"2025-12-01T13:00:00Z"},
  {id:10,job_id:8,author:"Darragh",body:"Actuator fitted and calibrated. Moving to final inspection 08/12.",created_at:"2025-12-04T09:30:00Z"},
  {id:11,job_id:9,author:"Darragh",body:"Running parallel with A007563. On track.",created_at:"2025-12-02T11:15:00Z"},
  {id:12,job_id:10,author:"Darragh",body:"Shipped 28/11. Delivery confirmed by Busch Ire.",created_at:"2025-11-28T17:00:00Z"},
  {id:13,job_id:11,author:"Shauna",body:"Minor additional seat lapping required — added 1 hour.",created_at:"2025-11-26T14:00:00Z"},
  {id:14,job_id:15,author:"Darragh",body:"Parts kitted and staged. Starting Monday 01/12.",created_at:"2025-11-28T16:00:00Z"},
  {id:15,job_id:17,author:"Darragh",body:"Assessment done. O-ring kit on order, delivery expected 05/12.",created_at:"2025-12-01T10:00:00Z"},
  {id:16,job_id:18,author:"Dave",body:"Customer has not confirmed scope. Cannot proceed without written sign-off.",created_at:"2025-12-01T14:00:00Z"},
  {id:17,job_id:19,author:"Ross",body:"Quick turnaround repair. Customer collected same day.",created_at:"2025-12-02T11:00:00Z"},
  {id:18,job_id:20,author:"Colin",body:"Seat grinding done. Moving to pressure testing phase tomorrow.",created_at:"2025-12-05T15:30:00Z"},
  {id:19,job_id:21,author:"Colin",body:"Rotating control valves confirmed for April 2026 window. Site access arranged.",created_at:"2025-12-01T09:00:00Z"},
  {id:20,job_id:22,author:"Dave",body:"8 vertical pump alignments. Exact dates still TBC with Astrazeneca facilities team.",created_at:"2025-12-01T09:00:00Z"},
  {id:21,job_id:23,author:"Dave",body:"Mag-drive investigation. Awaiting site access clearance from MSD HSE team.",created_at:"2025-11-28T13:00:00Z"},
  {id:22,job_id:24,author:"Colin",body:"Valve issue investigation. Site access booked for January window.",created_at:"2025-12-08T10:00:00Z"},
];

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const TODAY = new Date("2026-06-03");
const JOB_TYPES = ["Valve Assembly","Pump Assembly","Valve Overhaul","Pump Overhaul","Mechanical Seal Refurb","Testing","Site Visit"];
const PEOPLE = ["Darragh","Shauna","Cathal","Ross","Dave","Colin"];
const BUS = ["Pharma","Industrial","Engineering","Mining","Other"];

const COLORS = {
  navy:"#0B1F3A",orange:"#E8601A",steel:"#4A6380",steelLt:"#EDF2F7",
  mist:"#F5F7FA",rule:"#DDE3EC",text:"#1A2E44",textMid:"#4A6380",textSoft:"#8099B5",
  green:"#0E7C4A",greenLt:"#E8F7EF",red:"#C0392B",redLt:"#FEF2F2",
};

const fd = (d) => !d ? "—" : new Date(d).toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric" });
const isOD = (due, status) => status !== "Complete" && due && new Date(due) < TODAY;
const nowISO = () => new Date().toISOString();

const STATUS = {
  "In Progress":  { bg: "#FFF8E1", border: "#F59E0B", text: "#78350F", dot: "#F59E0B" },
  "Input Needed": { bg: COLORS.redLt,  border: COLORS.red,   text: "#7F1D1D", dot: COLORS.red },
  "Complete":     { bg: COLORS.greenLt,border: COLORS.green, text: "#064E3B", dot: COLORS.green },
};

const AVATAR_COLORS = {
  Darragh:"#1E3A5F",Shauna:"#6B21A8",Cathal:"#065F46",Ross:"#7C2D12",Dave:"#1D4ED8",Colin:"#92400E",
};

const TYPE_ICON = {
  "Valve Assembly":"🔧","Pump Assembly":"⚙","Valve Overhaul":"🔩",
  "Pump Overhaul":"🛠","Mechanical Seal Refurb":"💎","Testing":"🧪","Site Visit":"📍",
};

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function Avatar({ name, size = 30 }) {
  return (
    <div style={{
      width:size,height:size,borderRadius:"50%",background:AVATAR_COLORS[name]||COLORS.steel,
      color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.38,
      fontWeight:800,flexShrink:0,fontFamily:"'DM Mono',monospace",letterSpacing:-0.5,
      border:`2px solid rgba(255,255,255,0.15)`,
    }}>
      {name?.[0]}
    </div>
  );
}

function StatusPill({ status, small }) {
  const c = STATUS[status] || STATUS["In Progress"];
  return (
    <span style={{
      display:"inline-flex",alignItems:"center",gap:5,background:c.bg,border:`1px solid ${c.border}`,
      color:c.text,borderRadius:4,padding:small?"1px 7px":"3px 10px",fontSize:small?10:11,
      fontWeight:700,letterSpacing:0.03,whiteSpace:"nowrap",
    }}>
      <span style={{width:6,height:6,borderRadius:"50%",background:c.dot,flexShrink:0}} />
      {status}
    </span>
  );
}

function TypeBadge({ type }) {
  return (
    <span style={{
      display:"inline-flex",alignItems:"center",gap:4,background:COLORS.steelLt,color:COLORS.steel,
      borderRadius:4,padding:"2px 8px",fontSize:11,fontWeight:600,border:`1px solid ${COLORS.rule}`,
    }}>
      <span>{TYPE_ICON[type]||"🔧"}</span> {type}
    </span>
  );
}

function KpiCard({ value, label, accent }) {
  return (
    <div style={{
      background:"#fff",borderRadius:10,borderTop:`4px solid ${accent}`,padding:"14px 12px",
      flex:1,minWidth:80,boxShadow:"0 1px 6px rgba(11,31,58,0.07)",border:`1px solid ${COLORS.rule}`,
    }}>
      <div style={{fontSize:22,fontWeight:800,color:accent,fontFamily:"'DM Mono',monospace",lineHeight:1}}>{value}</div>
      <div style={{fontSize:8,textTransform:"uppercase",letterSpacing:0.1,color:COLORS.textSoft,marginTop:4,fontWeight:600}}>{label}</div>
    </div>
  );
}

function ProgressBar({ val, max, color }) {
  const pct = max > 0 ? Math.min(100, Math.round((val / max) * 100)) : 0;
  return (
    <div style={{background:COLORS.steelLt,borderRadius:3,height:6,width:"100%",overflow:"hidden"}}>
      <div style={{width:`${pct}%`,height:6,borderRadius:3,background:color||COLORS.orange,transition:"width 0.4s ease"}} />
    </div>
  );
}

function Toast({ msg, type = "success", onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2800); return () => clearTimeout(t); }, []);
  const bg = type === "error" ? COLORS.red : type === "warn" ? "#B45309" : COLORS.orange;
  return (
    <div style={{
      position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:bg,
      color:"#fff",padding:"10px 20px",borderRadius:8,fontSize:12,fontWeight:700,
      zIndex:1000,boxShadow:"0 6px 24px rgba(0,0,0,0.25)",animation:"slideUp 0.2s ease",whiteSpace:"nowrap",
    }}>
      {msg}
    </div>
  );
}

function NotesPanel({ job, notes, allJobs, allMode, onClose, onAddNote }) {
  const [text, setText] = useState("");
  const [newStatus, setNewStatus] = useState("");

  const displayNotes = allMode
    ? [...notes].sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,40)
    : notes.filter(n=>n.job_id===job?.id).sort((a,b)=>b.created_at.localeCompare(a.created_at));

  function submit() {
    if (!text.trim() && !newStatus) return;
    onAddNote(text.trim(), newStatus || null);
    setText(""); setNewStatus("");
  }

  return (
    <div style={{
      position:"fixed",inset:0,background:"rgba(11,31,58,0.55)",zIndex:300,
      display:"flex",alignItems:"flex-end",justifyContent:"center",
    }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{
        background:"#fff",borderRadius:"16px 16px 0 0",width:"100%",maxWidth:700,
        maxHeight:"88vh",display:"flex",flexDirection:"column",
        boxShadow:"0 -12px 48px rgba(11,31,58,0.25)",animation:"slideUp 0.22s ease",
      }}>
        <div style={{padding:"12px 14px 10px",borderBottom:`1px solid ${COLORS.rule}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontWeight:800,fontSize:13,color:COLORS.navy}}>
              {allMode?"📋 All Notes":`💬 ${job?.asm}`}
            </div>
            <div style={{fontSize:9,color:COLORS.textSoft,marginTop:2}}>{displayNotes.length}</div>
          </div>
          <button onClick={onClose} style={{background:COLORS.steelLt,border:"none",borderRadius:"50%",width:28,height:28,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",color:COLORS.steel}}>✕</button>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"10px 12px"}}>
          {displayNotes.length===0&&<div style={{textAlign:"center",padding:"24px 0",color:COLORS.textSoft,fontSize:12}}>No notes yet.</div>}
          {displayNotes.map((n,i)=>(
            <div key={n.id||i} style={{borderLeft:`3px solid ${COLORS.orange}`,paddingLeft:8,marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:2}}>
                <Avatar name={n.author} size={18} />
                <span style={{fontSize:9,fontWeight:700,color:COLORS.text}}>{n.author}</span>
                <span style={{fontSize:8,color:COLORS.textSoft,fontFamily:"'DM Mono',monospace"}}>{new Date(n.created_at).toLocaleString("en-IE",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</span>
                {allMode&&<span style={{fontSize:8,color:COLORS.orange,fontWeight:700,marginLeft:"auto"}}>{allJobs.find(x=>x.id===n.job_id)?.asm}</span>}
              </div>
              <div style={{fontSize:11,color:COLORS.text,lineHeight:1.4}}>{n.body}</div>
            </div>
          ))}
        </div>

        {!allMode&&job&&(
          <div style={{padding:"8px 12px",borderTop:`1px solid ${COLORS.rule}`,background:COLORS.mist}}>
            <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Update…" style={{width:"100%",border:`1px solid ${COLORS.rule}`,borderRadius:6,padding:"7px 8px",fontSize:11,resize:"none",minHeight:50,fontFamily:"inherit",background:"#fff",color:COLORS.text}}/>
            <div style={{display:"flex",gap:4,marginTop:6,alignItems:"center",flexWrap:"wrap"}}>
              <select value={newStatus} onChange={e=>setNewStatus(e.target.value)} style={{flex:1,minWidth:100,border:`1px solid ${COLORS.rule}`,borderRadius:6,padding:"5px 6px",fontSize:10,background:"#fff",color:COLORS.text,fontFamily:"inherit"}}>
                <option value="">Status</option>
                <option>In Progress</option>
                <option>Input Needed</option>
                <option>Complete</option>
              </select>
              <button onClick={submit} style={{background:COLORS.orange,color:"#fff",border:"none",borderRadius:6,padding:"5px 12px",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>Post</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function JobModal({ job, onSave, onClose }) {
  const [form, setForm] = useState(job?{...job,note:""}:{asm:"",so:"",customer:"",job_type:"Valve Assembly",business_unit:"Pharma",owner:"Darragh",allocated_to:"Darragh",date_issued:"",due_date:"",est_hours:"",act_hours:"",status:"In Progress",work_doc:"",note:""});
  const set = (k,v)=>setForm(f=>({...f,[k]:v}));
  const inputStyle={width:"100%",border:`1px solid ${COLORS.rule}`,borderRadius:6,padding:"7px 8px",fontSize:11,fontFamily:"inherit",background:"#fff",color:COLORS.text,outline:"none"};
  const inp=(k,p="",t="text")=><input type={t} value={form[k]||""} placeholder={p} onChange={e=>set(k,e.target.value)} style={inputStyle}/>;
  const sel=(k,opts)=><select value={form[k]||""} onChange={e=>set(k,e.target.value)} style={{...inputStyle,cursor:"pointer"}}>{opts.map(o=><option key={o}>{o}</option>)}</select>;

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,0.6)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:10}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"#fff",borderRadius:10,width:"100%",maxWidth:580,maxHeight:"90vh",overflow:"auto",boxShadow:"0 20px 60px rgba(11,31,58,0.3)"}}>
        <div style={{background:COLORS.navy,padding:"10px 14px",borderRadius:"10px 10px 0 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{color:"#fff",fontWeight:800,fontSize:13}}>{job?"Edit":"Add Job"}</div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",borderRadius:"50%",width:26,height:26,cursor:"pointer",fontSize:13}}>✕</button>
        </div>

        <div style={{padding:14,display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><label style={{fontSize:8,fontWeight:700,color:COLORS.textMid,textTransform:"uppercase",display:"block",marginBottom:3}}>Asm</label>{inp("asm","A007xxx")}</div>
          <div><label style={{fontSize:8,fontWeight:700,color:COLORS.textMid,textTransform:"uppercase",display:"block",marginBottom:3}}>SO</label>{inp("so")}</div>
          <div><label style={{fontSize:8,fontWeight:700,color:COLORS.textMid,textTransform:"uppercase",display:"block",marginBottom:3}}>Customer</label>{inp("customer")}</div>
          <div><label style={{fontSize:8,fontWeight:700,color:COLORS.textMid,textTransform:"uppercase",display:"block",marginBottom:3}}>BU</label>{sel("business_unit",BUS)}</div>
          <div><label style={{fontSize:8,fontWeight:700,color:COLORS.textMid,textTransform:"uppercase",display:"block",marginBottom:3}}>Type</label>{sel("job_type",JOB_TYPES)}</div>
          <div><label style={{fontSize:8,fontWeight:700,color:COLORS.textMid,textTransform:"uppercase",display:"block",marginBottom:3}}>Status</label>{sel("status",["In Progress","Input Needed","Complete"])}</div>
          <div><label style={{fontSize:8,fontWeight:700,color:COLORS.textMid,textTransform:"uppercase",display:"block",marginBottom:3}}>Owner</label>{sel("owner",PEOPLE)}</div>
          <div><label style={{fontSize:8,fontWeight:700,color:COLORS.textMid,textTransform:"uppercase",display:"block",marginBottom:3}}>Alloc</label>{sel("allocated_to",PEOPLE)}</div>
          <div><label style={{fontSize:8,fontWeight:700,color:COLORS.textMid,textTransform:"uppercase",display:"block",marginBottom:3}}>Issued</label>{inp("date_issued","","date")}</div>
          <div><label style={{fontSize:8,fontWeight:700,color:COLORS.textMid,textTransform:"uppercase",display:"block",marginBottom:3}}>Due</label>{inp("due_date","","date")}</div>
          <div><label style={{fontSize:8,fontWeight:700,color:COLORS.textMid,textTransform:"uppercase",display:"block",marginBottom:3}}>Est h</label>{inp("est_hours","","number")}</div>
          <div><label style={{fontSize:8,fontWeight:700,color:COLORS.textMid,textTransform:"uppercase",display:"block",marginBottom:3}}>Act h</label>{inp("act_hours","","number")}</div>
          <div style={{gridColumn:"span 2"}}><label style={{fontSize:8,fontWeight:700,color:COLORS.textMid,textTransform:"uppercase",display:"block",marginBottom:3}}>Doc</label>{inp("work_doc")}</div>
          <div style={{gridColumn:"span 2"}}><label style={{fontSize:8,fontWeight:700,color:COLORS.textMid,textTransform:"uppercase",display:"block",marginBottom:3}}>Note</label><textarea value={form.note||""} onChange={e=>set("note",e.target.value)} placeholder="…" style={{...inputStyle,resize:"none",minHeight:50}}/></div>
        </div>

        <div style={{borderTop:`1px solid ${COLORS.rule}`,padding:"8px 14px",display:"flex",gap:6,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{background:COLORS.steelLt,border:`1px solid ${COLORS.rule}`,borderRadius:6,padding:"6px 14px",fontSize:11,cursor:"pointer",fontFamily:"inherit",color:COLORS.text}}>Cancel</button>
          <button onClick={()=>onSave(form)} style={{background:COLORS.orange,color:"#fff",border:"none",borderRadius:6,padding:"6px 16px",fontSize:11,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>{job?"Save":"Add"}</button>
        </div>
      </div>
    </div>
  );
}

function DashboardView({ jobs, notes, onFilterEmp }) {
  const open = jobs.filter(j=>j.status!=="Complete");
  const ip=jobs.filter(j=>j.status==="In Progress").length;
  const inp=jobs.filter(j=>j.status==="Input Needed").length;
  const done=jobs.filter(j=>j.status==="Complete").length;
  const od=jobs.filter(j=>isOD(j.due_date,j.status)).length;
  const openHrs=open.reduce((a,j)=>a+(j.est_hours||0),0);

  const byEmp=useMemo(()=>{
    const m={};
    jobs.forEach(j=>{const k=j.allocated_to;if(!m[k])m[k]={jobs:0,hrs:0,ip:0,inp:0};m[k].jobs++;m[k].hrs+=j.est_hours||0;if(j.status==="In Progress")m[k].ip++;if(j.status==="Input Needed")m[k].inp++;});
    return Object.entries(m).sort((a,b)=>b[1].hrs-a[1].hrs);
  },[jobs]);

  const maxEmpHrs=Math.max(...byEmp.map(([,v])=>v.hrs),1);

  return (
    <div style={{padding:"10px",overflowY:"auto",height:"100%"}}>
      <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
        <KpiCard value={jobs.length} label="Jobs" accent={COLORS.navy}/>
        <KpiCard value={ip} label="IP" accent="#F59E0B"/>
        <KpiCard value={inp} label="Need" accent={COLORS.red}/>
        <KpiCard value={done} label="Done" accent={COLORS.green}/>
        <KpiCard value={od} label="OD" accent={od>0?COLORS.red:COLORS.textSoft}/>
        <KpiCard value={`${openHrs}h`} label="Hrs" accent={COLORS.orange}/>
      </div>

      <div style={{background:"#fff",borderRadius:8,border:`1px solid ${COLORS.rule}`,overflow:"hidden"}}>
        <div style={{background:COLORS.navy,color:"#fff",padding:"8px 12px",fontWeight:800,fontSize:11}}>👤 Employee Load</div>
        {byEmp.map(([name,v])=>(
          <div key={name} onClick={()=>onFilterEmp(name)} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 10px",borderBottom:`1px solid ${COLORS.steelLt}`,cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.background=COLORS.mist} onMouseLeave={e=>e.currentTarget.style.background=""}>
            <Avatar name={name} size={22}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:10}}>
                <span style={{fontWeight:700,color:COLORS.text}}>{name}</span>
                <span style={{color:COLORS.textSoft}}>{v.jobs}·{v.hrs}h</span>
              </div>
              <ProgressBar val={v.hrs} max={maxEmpHrs} color={COLORS.orange}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function JobCard({ job, notes, onStatusChange, onOpenNotes, onEdit }) {
  const od=isOD(job.due_date,job.status);
  const jobNotes=notes.filter(n=>n.job_id===job.id);
  const lastNote=jobNotes.sort((a,b)=>b.created_at.localeCompare(a.created_at))[0];
  const hasActuals=job.act_hours!=null;
  const over=hasActuals&&job.act_hours>job.est_hours;

  return (
    <div style={{background:"#fff",borderRadius:8,marginBottom:8,border:`1px solid ${od?"#FECACA":COLORS.rule}`,overflow:"hidden"}}>
      {od&&<div style={{background:COLORS.red,color:"#fff",padding:"2px 10px",fontSize:9,fontWeight:700}}>⚠ OVERDUE</div>}
      <div style={{padding:"9px 11px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:5,gap:5}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap",marginBottom:2}}>
              <span style={{fontFamily:"'DM Mono',monospace",fontWeight:800,fontSize:11,color:COLORS.navy}}>{job.asm}</span>
              <TypeBadge type={job.job_type}/>
            </div>
            <div style={{fontWeight:700,fontSize:12,color:COLORS.text,marginBottom:1}}>{job.customer}</div>
            <div style={{fontSize:9,color:COLORS.textSoft}}>Due {fd(job.due_date).replace(/[\s]/g,"")}{od?" ⚠":""}</div>
          </div>
          <select value={job.status} onChange={e=>onStatusChange(job.id,e.target.value)} style={{border:`1px solid ${COLORS.rule}`,borderRadius:4,padding:"3px 5px",fontSize:9,fontWeight:600,background:"#fff",color:COLORS.text,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
            <option>In Progress</option>
            <option>Input Needed</option>
            <option>Complete</option>
          </select>
        </div>

        <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:6}}>
          <Avatar name={job.allocated_to} size={18}/>
          <span style={{fontSize:10,color:COLORS.text,fontWeight:600}}>{job.allocated_to}</span>
          <span style={{fontSize:9,color:COLORS.textSoft,marginLeft:"auto"}}>{hasActuals?`${job.act_hours}/${job.est_hours}h`:`${job.est_hours}h`}</span>
        </div>

        {hasActuals&&<div style={{marginBottom:6}}><ProgressBar val={job.act_hours} max={job.est_hours} color={over?COLORS.red:COLORS.orange}/></div>}

        {lastNote&&<div style={{background:COLORS.mist,borderLeft:`2px solid ${COLORS.orange}`,padding:"4px 7px",borderRadius:"0 3px 3px 0",marginBottom:6,fontSize:9}}><div style={{color:COLORS.textSoft,marginBottom:1}}>{lastNote.author}</div><div style={{color:COLORS.text}}>{lastNote.body}</div></div>}

        <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
          <button onClick={()=>onOpenNotes(job.id)} style={{border:`1px solid ${COLORS.rule}`,borderRadius:4,padding:"3px 6px",fontSize:9,background:"#fff",cursor:"pointer",color:COLORS.steel,flex:1,minWidth:50}}>💬{jobNotes.length}</button>
          <button onClick={()=>onEdit(job.id)} style={{border:`1px solid ${COLORS.rule}`,borderRadius:4,padding:"3px 6px",fontSize:9,background:"#fff",cursor:"pointer",color:COLORS.steel}}>✏</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [jobs,setJobs]=useState(SEED_JOBS);
  const [notes,setNotes]=useState(SEED_NOTES);
  const [tab,setTab]=useState("jobs");
  const [filterStatus,setFilterStatus]=useState("");
  const [filterEmp,setFilterEmp]=useState("");
  const [search,setSearch]=useState("");
  const [notesJobId,setNotesJobId]=useState(null);
  const [allNotesOpen,setAllNotesOpen]=useState(false);
  const [editJobId,setEditJobId]=useState(null);
  const [addOpen,setAddOpen]=useState(false);
  const [toast,setToast]=useState(null);
  const [nextId,setNextId]=useState(26);
  const [nextNoteId,setNextNoteId]=useState(SEED_NOTES.length+1);

  const filtered=useMemo(()=>jobs.filter(j=>{if(filterStatus&&j.status!==filterStatus)return false;if(filterEmp&&j.allocated_to!==filterEmp&&j.owner!==filterEmp)return false;const q=search.toLowerCase();if(q&&!j.customer.toLowerCase().includes(q)&&!j.asm.toLowerCase().includes(q)&&!j.so.toLowerCase().includes(q))return false;return true;}),[jobs,filterStatus,filterEmp,search]);

  const inp_count=useMemo(()=>jobs.filter(j=>j.status==="Input Needed").length,[jobs]);
  const od_count=useMemo(()=>jobs.filter(j=>isOD(j.due_date,j.status)).length,[jobs]);

  function showToast(msg,type="success"){setToast({msg,type});}
  function updateStatus(id,status){setJobs(js=>js.map(j=>j.id===id?{...j,status}:j));showToast(`Status → ${status}`);}
  function openNotes(jobId){setNotesJobId(jobId);setAllNotesOpen(false);}
  function addNote(body,newStatus){if(!notesJobId)return;if(body){const job=jobs.find(j=>j.id===notesJobId);setNotes(ns=>[...ns,{id:nextNoteId,job_id:notesJobId,author:job?.allocated_to||"Team",body,created_at:nowISO()}]);setNextNoteId(n=>n+1);}if(newStatus)setJobs(js=>js.map(j=>j.id===notesJobId?{...j,status:newStatus}:j));showToast("Note posted ✓");setNotesJobId(null);}
  function saveJob(form){const noteText=form.note?.trim();if(editJobId){setJobs(js=>js.map(j=>j.id===editJobId?{...j,...form,est_hours:parseFloat(form.est_hours)||0,act_hours:form.act_hours?parseFloat(form.act_hours):null}:j));if(noteText){const job=jobs.find(j=>j.id===editJobId);setNotes(ns=>[...ns,{id:nextNoteId,job_id:editJobId,author:job?.allocated_to||"Team",body:noteText,created_at:nowISO()}]);setNextNoteId(n=>n+1);}showToast("Job updated ✓");}else{const id=nextId;setNextId(n=>n+1);const newJob={...form,id,est_hours:parseFloat(form.est_hours)||0,act_hours:form.act_hours?parseFloat(form.act_hours):null};setJobs(js=>[...js,newJob]);if(noteText){setNotes(ns=>[...ns,{id:nextNoteId,job_id:id,author:form.allocated_to||"Team",body:noteText,created_at:nowISO()}]);setNextNoteId(n=>n+1);}showToast("Job added ✓");}setAddOpen(false);setEditJobId(null);}

  const editJob=editJobId?jobs.find(j=>j.id===editJobId):null;
  const notesJob=notesJobId?jobs.find(j=>j.id===notesJobId):null;

  return <>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@600;700;800&family=Mulish:wght@300;400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0;}html,body,#root{height:100%;width:100%;}body{font-family:'Mulish',sans-serif;background:${COLORS.mist};}::-webkit-scrollbar{width:4px;height:4px;}::-webkit-scrollbar-thumb{background:${COLORS.rule};border-radius:2px;}@keyframes slideUp{from{transform:translateY(30px);opacity:0;}to{transform:translateY(0);opacity:1;}}`}</style>

    <div style={{height:"100vh",display:"flex",flexDirection:"column",background:COLORS.mist,width:"100%"}}>
      <div style={{background:COLORS.navy,flexShrink:0,padding:"8px 10px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:7}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{background:COLORS.orange,borderRadius:5,width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:14}}>⚙</div>
            <div><div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:12,color:"#fff",letterSpacing:-0.2}}>Flexachem</div><div style={{fontSize:7,color:COLORS.orange,fontWeight:700,letterSpacing:0.06,textTransform:"uppercase"}}>Job Tracker</div></div>
          </div>
          <div style={{display:"flex",gap:5,alignItems:"center"}}>
            {od_count>0&&<div style={{background:COLORS.red,color:"#fff",borderRadius:5,padding:"1px 6px",fontSize:9,fontWeight:800}}>{od_count}</div>}
            {inp_count>0&&<div style={{background:"#F59E0B",color:"#fff",borderRadius:5,padding:"1px 6px",fontSize:9,fontWeight:800}}>⚠{inp_count}</div>}
            <button onClick={()=>{setAddOpen(true);setEditJobId(null);}} style={{background:COLORS.orange,color:"#fff",border:"none",borderRadius:4,padding:"4px 8px",fontSize:10,fontWeight:800,cursor:"pointer"}}>＋</button>
          </div>
        </div>

        {tab==="jobs"&&<div style={{display:"flex",gap:4,overflowX:"auto",paddingBottom:2,scrollbarWidth:"none"}}>
          {["","In Progress","Input Needed","Complete"].map(s=><button key={s} onClick={()=>setFilterStatus(s)} style={{background:filterStatus===s?"#fff":"rgba(255,255,255,0.08)",color:filterStatus===s?COLORS.navy:"rgba(255,255,255,0.6)",border:"none",borderRadius:14,padding:"2px 9px",fontSize:9,fontWeight:filterStatus===s?700:400,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,fontFamily:"inherit"}}>{s||"All"}</button>)}
          <select value={filterEmp} onChange={e=>setFilterEmp(e.target.value)} style={{background:filterEmp?"#fff":"rgba(255,255,255,0.08)",color:filterEmp?COLORS.navy:"rgba(255,255,255,0.6)",border:"none",borderRadius:14,padding:"2px 7px",fontSize:9,fontWeight:filterEmp?700:400,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}><option value="">All</option>{PEOPLE.map(p=><option key={p}>{p}</option>)}</select>
        </div>}

        <div style={{display:"flex",marginTop:6,borderTop:"1px solid rgba(255,255,255,0.1)",paddingTop:5}}>
          {["jobs","dash","search"].map(t=><button key={t} onClick={()=>setTab(t)} style={{flex:1,border:"none",background:tab===t?COLORS.mist:"transparent",color:tab===t?COLORS.navy:"rgba(255,255,255,0.5)",padding:"6px 0",fontSize:9,fontWeight:tab===t?700:400,cursor:"pointer",fontFamily:"inherit",borderBottom:tab===t?`2px solid ${COLORS.orange}`:"2px solid transparent"}}>{t==="jobs"?"📋":"dash"?"📊":"🔍"}</button>)}
          <button onClick={()=>setAllNotesOpen(true)} style={{flex:1,border:"none",background:"transparent",color:"rgba(255,255,255,0.5)",padding:"6px 0",fontSize:9,fontWeight:400,cursor:"pointer",fontFamily:"inherit",borderBottom:"2px solid transparent"}}>💬</button>
        </div>
      </div>

      {tab==="search"&&<div style={{padding:"8px 10px",background:"#fff",borderBottom:`1px solid ${COLORS.rule}`,flexShrink:0}}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…" autoFocus style={{width:"100%",border:`1px solid ${COLORS.rule}`,borderRadius:6,padding:"8px 10px",fontSize:11,fontFamily:"inherit",background:COLORS.mist,color:COLORS.text}}/></div>}

      <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
        {(tab==="jobs"||tab==="search")&&<div style={{flex:1,overflowY:"auto",padding:"8px"}}>{filtered.length===0&&<div style={{textAlign:"center",padding:"28px 0",color:COLORS.textSoft,fontSize:11}}>No jobs</div>}{filtered.map(j=><JobCard key={j.id} job={j} notes={notes} onStatusChange={updateStatus} onOpenNotes={openNotes} onEdit={id=>{setEditJobId(id);setAddOpen(true);}}/>)}</div>}
        {tab==="dash"&&<DashboardView jobs={jobs} notes={notes} onFilterEmp={name=>{setFilterEmp(name);setTab("jobs");}}/>}
      </div>
    </div>

    {(notesJobId||allNotesOpen)&&<NotesPanel job={notesJob} notes={notes} allJobs={jobs} allMode={allNotesOpen} onClose={()=>{setNotesJobId(null);setAllNotesOpen(false);}} onAddNote={addNote}/>}
    {addOpen&&<JobModal job={editJob} onSave={saveJob} onClose={()=>{setAddOpen(false);setEditJobId(null);}}/>}
    {toast&&<Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}
  </>;
}
