import { useState, useMemo } from "react";

// ─── DATA & CONSTANTS ─────────────────────────────────────────────────────────
const SEED_JOBS = [
  {id:1,asm:"A007529",so:"296966",customer:"Busch Ire",job_type:"Valve Overhaul",est_hours:6,act_hours:6,status:"Complete"},
  {id:2,asm:"A007527",so:"296966",customer:"Busch Ire",job_type:"Valve Assembly",est_hours:2,act_hours:2,status:"Complete"},
  {id:3,asm:"A007445",so:"296987",customer:"Aughinish",job_type:"Pump Overhaul",est_hours:4,act_hours:6,status:"Complete"},
  {id:4,asm:"A007582",so:"297516",customer:"BMD",job_type:"Mechanical Seal",est_hours:6,act_hours:3,status:"In Progress"},
  {id:5,asm:"A007583",so:"297516",customer:"BMD",job_type:"Mechanical Seal",est_hours:3,act_hours:0,status:"In Progress"},
];

const COLORS = {
  navy: "#0B1F3A", orange: "#E8601A", steelLt: "#EDF2F7",
  text: "#1A2E44", textSoft: "#8099B5", greenLt: "#E8F7EF", rule: "#DDE3EC"
};

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState("jobs");

  // Calculate Summary Row data
  const summary = useMemo(() => {
    return SEED_JOBS.reduce((acc, curr) => ({
      est: acc.est + (curr.est_hours || 0),
      act: acc.act + (curr.act_hours || 0),
      count: acc.count + 1
    }), { est: 0, act: 0, count: 0 });
  }, []);

  if (!authenticated) {
    return (
      <div style={{display:'flex',height:'100vh',alignItems:'center',justifyContent:'center',background:COLORS.steelLt}}>
        <div style={{padding:40,background:'white',borderRadius:8,boxShadow:'0 4px 12px rgba(0,0,0,0.1)'}}>
          <h2 style={{color:COLORS.navy}}>Flexachem Login</h2>
          <input type="password" placeholder="Password" onChange={(e) => setPassword(e.target.value)} style={{display:'block',width:'100%',padding:8,marginBottom:10}}/>
          <button onClick={() => password === "flexachem2026" && setAuthenticated(true)} style={{background:COLORS.orange,color:'white',border:'none',padding:'10px 20px',cursor:'pointer'}}>Login</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{display: 'flex', height: '100vh', fontFamily: 'sans-serif'}}>
      <aside style={{width: 250, background: COLORS.navy, color: 'white', padding: 20}}>
        <h2 style={{fontSize: 18, marginBottom: 30}}>Flexachem <span style={{color:COLORS.orange}}>Tracker</span></h2>
        <div style={{display:'flex', flexDirection:'column', gap:10}}>
          <button onClick={()=>setTab("jobs")} style={{background:'none',border:'none',color:'white',textAlign:'left',cursor:'pointer'}}>📋 Work Orders</button>
          <button onClick={()=>setAuthenticated(false)} style={{background:'none',border:'none',color:'white',textAlign:'left',marginTop:20,cursor:'pointer'}}>Logout</button>
        </div>
      </aside>

      <main style={{flex: 1, padding: 30, background: '#fff', overflowY: 'auto'}}>
        <h1 style={{color:COLORS.navy, marginBottom: 20}}>Work Orders</h1>
        
        {/* High Density Table with Summary Row */}
        <table style={{width: '100%', borderCollapse: 'collapse'}}>
          <thead>
            <tr style={{borderBottom: `2px solid ${COLORS.navy}`, textAlign: 'left'}}>
              <th style={{padding: 10}}>ASM/SO</th>
              <th style={{padding: 10}}>Customer</th>
              <th style={{padding: 10}}>Type</th>
              <th style={{padding: 10, textAlign:'right'}}>Est / Act</th>
              <th style={{padding: 10}}>Status</th>
            </tr>
          </thead>
          <tbody>
            {/* Dedicated Summary Row */}
            <tr style={{background: COLORS.steelLt, fontWeight: 800}}>
              <td style={{padding: 10}}>TOTAL ({summary.count})</td>
              <td></td>
              <td></td>
              <td style={{textAlign:'right', padding: 10}}>{summary.est}h / {summary.act}h</td>
              <td></td>
            </tr>
            {SEED_JOBS.map(j => (
              <tr key={j.id} style={{borderBottom: `1px solid ${COLORS.rule}`}}>
                <td style={{padding: 10}}>{j.asm}<br/><small style={{color:COLORS.textSoft}}>{j.so}</small></td>
                <td style={{padding: 10}}>{j.customer}</td>
                <td style={{padding: 10}}>{j.job_type}</td>
                <td style={{padding: 10, textAlign:'right'}}>{j.est_hours} / {j.act_hours}</td>
                <td style={{padding: 10}}>
                  <span style={{padding:'2px 8px', borderRadius:4, background:COLORS.greenLt, fontSize:11}}>{j.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
}