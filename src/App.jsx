import { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  DndContext,
  closestCenter,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// -------------------- Supabase --------------------
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// -------------------- Constants --------------------
const TODAY = new Date("2026-06-03");
const JOB_TYPES = ["Valve Assembly","Pump Assembly","Valve Overhaul","Pump Overhaul","Mechanical Seal Refurb","Testing","Site Visit"];
const DEFAULT_PEOPLE = ["Darragh","Shauna","Cathal","Ross","Dave","Colin"];
const BUS = ["Pharma","Industrial","Engineering","Mining","Other"];

const COLORS = {
  navy:"#0B1F3A", navyMid:"#122847", orange:"#E8601A", orangeMid:"#F9845A", orangeLt:"#FFF0E8",
  steel:"#4A6380", steelLt:"#EDF2F7", slate:"#2D4A6E", textDark:"#1A202C", textMid:"#4A5568",
  rule:"#E2E8F0", green:"#2F855A", greenLt:"#E6FFFA", red:"#C53030", redLt:"#FFF5F5",
  blue:"#2B6CB0", blueLt:"#EBF8FF", yellow:"#B7791F", yellowLt:"#FEFCBF", purple:"#6B46C1", purpleLt:"#F3E8FF"
};

export default function App() {
  // --- ALL HOOKS MUST SIT AT THE TOP UNCONDITIONALLY ---
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("board"); // board, timeline, list
  const [search, setSearch] = useState("");
  const [filterEmp, setFilterEmp] = useState("");
  const [editingJob, setEditingJob] = useState(null);
  const [notesJobId, setNotesJobId] = useState(null);
  const [allNotesOpen, setAllNotesOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);

  // Auth States
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [authError, setAuthError] = useState("");

  // Drag State
  const [activeId, setActiveId] = useState(null);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !supabase) return;
    fetchJobs();
    
    const channel = supabase
      .channel("schema-db-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, () => {
        fetchJobs();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // All useMemo and Sensor hooks moved up here before any conditional returns
  const sensors = useSensors(useSensor(PointerSensor));

  const filtered = useMemo(() => {
    return jobs.filter(j => {
      const mText = ((j.asm || "") + (j.so || "") + (j.cust || "") + (j.type || "") + (j.alloc || "") + (j.notes || "")).toLowerCase();
      const matchSearch = mText.includes(search.toLowerCase());
      const matchEmp = !filterEmp || j.alloc === filterEmp || (j.notes && j.notes.toLowerCase().includes(filterEmp.toLowerCase()));
      return matchSearch && matchEmp;
    });
  }, [jobs, search, filterEmp]);

  const bookedHrs = useMemo(() => {
    return filtered.reduce((sum, j) => sum + (parseFloat(j.hrs) || 0), 0);
  }, [filtered]);

  const people = useMemo(() => {
    const s = new Set(DEFAULT_PEOPLE);
    jobs.forEach(j => { if (j.alloc) s.add(j.alloc); });
    return Array.from(s);
  }, [jobs]);

  const activeJob = useMemo(() => jobs.find(j => j.id === activeId), [activeId, jobs]);
  const notesJob = useMemo(() => jobs.find(j => j.id === notesJobId), [notesJobId, jobs]);

  const notes = useMemo(() => {
    if (allNotesOpen) {
      let arr = [];
      jobs.forEach(j => {
        if (j.notes) {
          try {
            const parsed = typeof j.notes === "string" ? JSON.parse(j.notes) : j.notes;
            if (Array.isArray(parsed)) {
              parsed.forEach(n => arr.push({ ...n, jobId: j.id, jobAsm: j.asm, jobCust: j.cust }));
            }
          } catch(e){}
        }
      });
      return arr.sort((a,b) => new Date(b.at) - new Date(a.at));
    }
    if (!notesJob || !notesJob.notes) return [];
    try {
      const parsed = typeof notesJob.notes === "string" ? JSON.parse(notesJob.notes) : notesJob.notes;
      return Array.isArray(parsed) ? parsed : [];
    } catch(e) {
      return [];
    }
  }, [notesJob, jobs, allNotesOpen]);

  // --- HANDLERS ---
  const fetchJobs = async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase.from("jobs").select("*").order("id", { ascending: true });
    if (!error && data) setJobs(data);
    setLoading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!supabase) return;
    setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPass });
    if (error) setAuthError(error.message);
  };

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  const handleDragStart = (e) => {
    setActiveId(e.active.id);
  };

  const handleDragEnd = async (e) => {
    const { active, over } = e;
    setActiveId(null);
    if (!over || !supabase) return;
    const jobId = active.id;
    const newStatus = over.id;
    
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: newStatus } : j));
    
    const { error } = await supabase.from("jobs").update({ status: newStatus }).eq("id", jobId);
    if (error) fetchJobs();
  };

  const handleSaveJob = async (fields) => {
    if (!supabase) return;
    if (editingJob && editingJob.id) {
      const { error } = await supabase.from("jobs").update(fields).eq("id", editingJob.id);
      if (!error) setEditingJob(null);
    } else {
      const { error } = await supabase.from("jobs").insert([{ ...fields, status: "Not Started", notes: "[]" }]);
      if (!error) setEditingJob(null);
    }
    fetchJobs();
  };

  const handleDeleteJob = async (id) => {
    if (!supabase || !window.confirm("Delete this job?")) return;
    const { error } = await supabase.from("jobs").delete().eq("id", id);
    if (!error) fetchJobs();
  };

  const handleAddNote = async (jobId, txt) => {
    if (!supabase) return;
    const tgt = jobs.find(j => j.id === jobId);
    if (!tgt) return;
    let current = [];
    try {
      current = typeof tgt.notes === "string" ? JSON.parse(tgt.notes) : tgt.notes;
      if (!Array.isArray(current)) current = [];
    } catch(e){}
    
    const newNote = {
      at: new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      by: user?.email?.split("@")[0] || "User",
      txt
    };
    const updated = [newNote, ...current];
    
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, notes: JSON.stringify(updated) } : j));
    await supabase.from("jobs").update({ notes: JSON.stringify(updated) }).eq("id", jobId);
  };

  // --- EARLY RENDERS ARE NOW SAFE BELOW THE HOOKS ---
  if (authLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: COLORS.navy, color: "#fff", fontFamily: "sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Flexachem Workshop Tracker</div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>Loading session...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: COLORS.navy, fontFamily: "sans-serif" }}>
        <form onSubmit={handleLogin} style={{ background: "#fff", padding: 30, borderRadius: 8, width: 320, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
          <h3 style={{ margin: "0 0 20px 0", color: COLORS.navy, fontSize: 18, fontWeight: 700, textAlign: "center" }}>Workshop Tracker Login</h3>
          {authError && <div style={{ background: COLORS.redLt, color: COLORS.red, padding: "8px 12px", borderRadius: 4, fontSize: 12, marginBottom: 15, border: `1px solid ${COLORS.red}` }}>{authError}</div>}
          <div style={{ marginBottom: 15 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: COLORS.textMid, marginBottom: 4 }}>Email Address</label>
            <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required style={{ width: "100%", padding: "8px 10px", borderRadius: 4, border: `1px solid ${COLORS.rule}`, fontSize: 13, boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: COLORS.textMid, marginBottom: 4 }}>Password</label>
            <input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} required style={{ width: "100%", padding: "8px 10px", borderRadius: 4, border: `1px solid ${COLORS.rule}`, fontSize: 13, boxSizing: "border-box" }} />
          </div>
          <button type="submit" style={{ width: "100%", background: COLORS.orange, color: "#fff", padding: "10px", borderRadius: 4, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Sign In</button>
        </form>
      </div>
    );
  }

  const renderContent = () => {
    if (loading) return <div style={{ padding: 40, textAlign: "center", color: COLORS.textMid, fontSize: 13 }}>Loading jobs...</div>;
    if (view === "timeline") return <TimelineView jobs={filtered} onEdit={setEditingJob} onNotes={setNotesJobId} />;
    if (view === "list") return <ListView jobs={filtered} onEdit={setEditingJob} onNotes={setNotesJobId} onDelete={handleDeleteJob} />;
    
    const columns = {
      "Not Started": filtered.filter(j => j.status === "Not Started"),
      "In Progress": filtered.filter(j => j.status === "In Progress"),
      "Input Needed": filtered.filter(j => j.status === "Input Needed"),
      "Complete": filtered.filter(j => j.status === "Complete")
    };

    return (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div style={{ display: "flex", gap: 16, padding: 16, height: "100%", overflowX: "auto", alignItems: "flex-start", boxSizing: "border-box" }}>
          {Object.entries(columns).map(([colId, colJobs]) => (
            <Column key={colId} id={colId} title={colId} count={colJobs.length}>
              <SortableContext items={colJobs.map(j => j.id)} strategy={verticalListSortingStrategy}>
                {colJobs.map(j => <JobCard key={j.id} job={j} onEdit={setEditingJob} onNotes={setNotesJobId} />)}
              </SortableContext>
            </Column>
          ))}
        </div>
        <DragOverlay>
          {activeId && activeJob ? <JobCard job={activeJob} isOverlay /> : null}
        </DragOverlay>
      </DndContext>
    );
  };

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", overflow: "hidden", background: "#F7FAFC", color: COLORS.textDark, fontFamily: "sans-serif" }}>
      {/* Sidebar */}
      <div style={{ width: 220, background: COLORS.navy, color: "#fff", display: "flex", flexDirection: "column", borderRight: `1px solid ${COLORS.navyMid}` }}>
        <div style={{ padding: "24px 16px", borderBottom: `1px solid ${COLORS.navyMid}` }}>
          <div style={{ fontSize: 15, fontWeight: 800, tracking: "0.5px", color: "#fff" }}>FLEXACHEM</div>
          <div style={{ fontSize: 10, color: COLORS.orange, fontWeight: 700, marginTop: 2, tracking: "1px" }}>WORKSHOP TRACKER</div>
        </div>
        
        <div style={{ flex: 1, padding: "16px 8px", display: "flex", flexDirection: "column", gap: 4 }}>
          <button onClick={() => setView("board")} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: view === "board" ? COLORS.slate : "transparent", border: "none", color: "#fff", padding: "10px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, textAlign: "left", cursor: "pointer" }}>📋 Board View</button>
          <button onClick={() => setView("timeline")} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: view === "timeline" ? COLORS.slate : "transparent", border: "none", color: "#fff", padding: "10px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, textAlign: "left", cursor: "pointer" }}>⏱️ Schedule Timeline</button>
          <button onClick={() => setView("list")} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: view === "list" ? COLORS.slate : "transparent", border: "none", color: "#fff", padding: "10px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, textAlign: "left", cursor: "pointer" }}>⚙️ Detailed Master List</button>
          
          <div style={{ height: 1, background: COLORS.navyMid, margin: "12px 0" }} />
          
          <button onClick={() => setAllNotesOpen(true)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "transparent", border: "none", color: "#A0AEC0", padding: "8px 12px", borderRadius: 6, fontSize: 12, textAlign: "left", cursor: "pointer" }}>💬 All Recent Notes</button>
          <button onClick={() => setLogsOpen(true)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "transparent", border: "none", color: "#A0AEC0", padding: "8px 12px", borderRadius: 6, fontSize: 12, textAlign: "left", cursor: "pointer" }}>📜 Complete History Logs</button>
        </div>

        <div style={{ padding: 12, borderTop: `1px solid ${COLORS.navyMid}`, background: COLORS.navyMid, display: "flex", alignItems: "center", justifyContent: "between", gap: 8 }}>
          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11, color: "#A0AEC0", flex: 1 }}>{user.email}</div>
          <button onClick={handleLogout} style={{ background: "transparent", border: "none", color: COLORS.orange, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Exit</button>
        </div>
      </div>

      {/* Main Panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Topbar */}
        <div style={{ background: "#fff", height: 56, borderBottom: `1px solid ${COLORS.rule}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: COLORS.navy }}>
              {view === "board" && "Workshop Floor Columns"}
              {view === "timeline" && "Master Schedule Timeline"}
              {view === "list" && "Detailed Assembly Registry"}
            </h2>
            <button onClick={() => setEditingJob({})} style={{ background: COLORS.orange, color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>+ Log New Job</button>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <select value={filterEmp} onChange={e => setFilterEmp(e.target.value)} style={{ border: `1px solid ${COLORS.rule}`, borderRadius: 6, padding: "6px 10px", fontSize: 11, background: "#fff" }}>
              <option value="">All People</option>
              {people.map(p => <option key={p}>{p}</option>)}
            </select>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ border: `1px solid ${COLORS.rule}`, borderRadius: 6, padding: "6px 10px", fontSize: 11, width: 180, background: "#fff" }} />
            <div style={{ background: COLORS.navy, color: "#fff", borderRadius: 6, padding: "6px 12px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>📦 Jobs Booked: <span style={{ fontFamily: "monospace" }}>{bookedHrs}h</span>{filterEmp && <span style={{ opacity: 0.7, fontSize: 9, marginLeft: 4 }}>({filterEmp})</span>}</div>
            <div style={{ background: COLORS.steelLt, borderRadius: 6, padding: "6px 10px", fontSize: 10, color: COLORS.textMid }}>{filtered.length}/{jobs.length}</div>
          </div>
        </div>
        
        <div style={{ flex: 1, overflow: "auto" }}>{renderContent()}</div>
      </div>
    </div>
    
    {(notesJobId || allNotesOpen) && (
      <NotesPanel job={notesJob} notes={notes} allJobs={jobs} allMode={allNotesOpen} onClose={() => { setNotesJobId(null); setAllNotesOpen(false); }} onAddNote={handleAddNote} />
    )}
    
    {editingJob && (
      <JobModal job={editingJob} onClose={() => setEditingJob(null)} onSave={handleSaveJob} people={people} />
    )}
    
    <LogsModal isOpen={logsOpen} onClose={() => setLogsOpen(false)} jobs={jobs} />
  );
}

// -------------------- Sub Components --------------------
function Column({ id, title, count, children }) {
  const { setNodeRef } = useSortable({ id });
  
  const bg = id === "Not Started" ? "#EDF2F7" : id === "In Progress" ? COLORS.blueLt : id === "Input Needed" ? COLORS.yellowLt : COLORS.greenLt;
  const tc = id === "Not Started" ? COLORS.textDark : id === "In Progress" ? COLORS.blue : id === "Input Needed" ? COLORS.yellow : COLORS.green;

  return (
    <div style={{ background: "#F1F5F9", width: 280, borderRadius: 8, display: "flex", flexDirection: "column", maxHeight: "100%", flexShrink: 0, border: "1px solid #E2E8F0" }}>
      <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", tracking: "0.5px", color: COLORS.navy }}>{title}</span>
          <span style={{ background: bg, color: tc, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>{count}</span>
        </div>
      </div>
      <div ref={setNodeRef} style={{ flex: 1, padding: "0 10px 10px 10px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, minHeight: 150 }}>
        {children}
      </div>
    </div>
  );
}

function JobCard({ job, onEdit, onNotes, isOverlay }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: job.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    background: "#fff",
    padding: 12,
    borderRadius: 6,
    boxShadow: isOverlay ? "0 10px 20px rgba(0,0,0,0.15)" : "0 1px 3px rgba(0,0,0,0.05)",
    borderLeft: `4px solid ${job.type === "Valve Assembly" ? COLORS.orange : job.type === "Pump Assembly" ? COLORS.blue : job.type === "Valve Overhaul" ? COLORS.purple : job.type === "Pump Overhaul" ? COLORS.yellow : COLORS.steel}`,
    cursor: "grab",
    boxSizing: "border-box"
  };

  let notePreview = "";
  if (job.notes) {
    try {
      const arr = typeof job.notes === "string" ? JSON.parse(job.notes) : job.notes;
      if (Array.isArray(arr) && arr.length > 0) notePreview = arr[0].txt;
    } catch(e){}
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.textMid }}>{job.cust || "No Customer"}</span>
        <span style={{ fontSize: 10, background: COLORS.steelLt, color: COLORS.textMid, padding: "2px 6px", borderRadius: 4, fontFamily: "monospace" }}>{job.so || "No SO"}</span>
      </div>
      
      <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.navy, marginBottom: 8 }}>
        {job.asm} <span style={{ fontWeight: 400, color: COLORS.textMid, fontSize: 11 }}>- {job.type}</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, borderTop: `1px solid ${COLORS.rule}`, paddingTop: 8 }}>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span style={{ fontSize: 10, background: COLORS.orangeLt, color: COLORS.orange, padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>👤 {job.alloc || "Unassigned"}</span>
          {job.hrs && <span style={{ fontSize: 10, background: "#EDF2F7", color: COLORS.textMid, padding: "2px 6px", borderRadius: 4 }}>⏱️ {job.hrs}h</span>}
        </div>
        
        <div style={{ display: "flex", gap: 4 }}>
          <button onPointerDown={e => { e.stopPropagation(); onNotes(job.id); }} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 12, padding: 2 }}>💬</button>
          <button onPointerDown={e => { e.stopPropagation(); onEdit(job); }} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 12, padding: 2 }}>✏️</button>
        </div>
      </div>
      
      {notePreview && (
        <div style={{ marginTop: 6, fontSize: 10, color: COLORS.textMid, background: "#F7FAFC", padding: "4px 6px", borderRadius: 4, fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          Latest: "{notePreview}"
        </div>
      )}
    </div>
  );
}

function TimelineView({ jobs }) {
  return (
    <div style={{ padding: 20, background: "#fff", margin: 16, borderRadius: 8, border: `1px solid ${COLORS.rule}` }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.navy, marginBottom: 12 }}>Active Schedule Layout</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {jobs.map(j => (
          <div key={j.id} style={{ display: "flex", alignItems: "center", padding: 10, background: "#F8FAFC", borderRadius: 6, border: `1px solid ${COLORS.rule}`, fontSize: 12 }}>
            <div style={{ width: 120, fontWeight: 700, color: COLORS.navy }}>{j.cust}</div>
            <div style={{ width: 100, fontFamily: "monospace" }}>{j.so}</div>
            <div style={{ width: 120 }}>{j.asm}</div>
            <div style={{ flex: 1, color: COLORS.textMid }}>{j.type}</div>
            <div style={{ width: 100, fontWeight: 600, color: COLORS.orange }}>{j.alloc || "Unassigned"}</div>
            <div style={{ width: 120, color: COLORS.textMid }}>Target: {j.due || "TBA"}</div>
            <div style={{ width: 100, textAlign: "right", fontWeight: 700 }}>{j.hrs || 0} hrs</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ListView({ jobs, onEdit, onNotes, onDelete }) {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 8, border: `1px solid ${COLORS.rule}`, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: `1px solid ${COLORS.rule}`, color: COLORS.textMid, fontWeight: 600 }}>
              <th style={{ padding: 12 }}>Assembly ID</th>
              <th style={{ padding: 12 }}>Sales Order</th>
              <th style={{ padding: 12 }}>Customer</th>
              <th style={{ padding: 12 }}>Job Classification</th>
              <th style={{ padding: 12 }}>Owner</th>
              <th style={{ padding: 12 }}>Allocated To</th>
              <th style={{ padding: 12 }}>Est. Hrs</th>
              <th style={{ padding: 12 }}>Target Completion</th>
              <th style={{ padding: 12 }}>Status</th>
              <th style={{ padding: 12, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map(j => (
              <tr key={j.id} style={{ borderBottom: `1px solid ${COLORS.rule}`, color: COLORS.textDark }}>
                <td style={{ padding: 12, fontWeight: 700 }}>{j.asm}</td>
                <td style={{ padding: 12, fontFamily: "monospace" }}>{j.so}</td>
                <td style={{ padding: 12 }}>{j.cust}</td>
                <td style={{ padding: 12 }}>{j.type}</td>
                <td style={{ padding: 12 }}>{j.owner || "-"}</td>
                <td style={{ padding: 12, fontWeight: 600, color: COLORS.orange }}>{j.alloc || "Unassigned"}</td>
                <td style={{ padding: 12 }}>{j.hrs || 0}h</td>
                <td style={{ padding: 12 }}>{j.due || "TBA"}</td>
                <td style={{ padding: 12 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: j.status === "Complete" ? COLORS.greenLt : j.status === "In Progress" ? COLORS.blueLt : j.status === "Input Needed" ? COLORS.yellowLt : "#EDF2F7", color: j.status === "Complete" ? COLORS.green : j.status === "In Progress" ? COLORS.blue : j.status === "Input Needed" ? COLORS.yellow : COLORS.textDark }}>
                    {j.status}
                  </span>
                </td>
                <td style={{ padding: 12, textAlign: "right" }}>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button onClick={() => onNotes(j.id)} style={{ background: "none", border: "none", cursor: "pointer" }}>💬</button>
                    <button onClick={() => onEdit(j)} style={{ background: "none", border: "none", cursor: "pointer" }}>✏️</button>
                    <button onClick={() => onDelete(j.id)} style={{ background: "none", border: "none", cursor: "pointer" }}>🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function JobModal({ job, onClose, onSave, people }) {
  const [asm, setAsm] = useState(job.asm || "");
  const [so, setSo] = useState(job.so || "");
  const [cust, setCust] = useState(job.cust || "");
  const [type, setType] = useState(job.type || "Valve Assembly");
  const [owner, setOwner] = useState(job.owner || "");
  const [alloc, setAlloc] = useState(job.alloc || "");
  const [due, setDue] = useState(job.due || "");
  const [hrs, setHrs] = useState(job.hrs || "");
  const [bus, setBus] = useState(job.bus || "Industrial");

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ asm, so, cust, type, owner, alloc, due, hrs, bus });
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, fontFamily: "sans-serif" }}>
      <form onSubmit={handleSubmit} style={{ background: "#fff", padding: 24, borderRadius: 8, width: 400, boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
        <h3 style={{ margin: "0 0 16px 0", color: COLORS.navy, fontSize: 16 }}>{job.id ? "Modify Production Entry" : "Record New Assembly Job"}</h3>
        
        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Assembly No / Tag</label>
            <input value={asm} onChange={e => setAsm(e.target.value)} required style={{ width: "100%", padding: 6, boxSizing: "border-box" }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Sales Order (SO)</label>
            <input value={so} onChange={e => setSo(e.target.value)} required style={{ width: "100%", padding: 6, boxSizing: "border-box" }} />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Customer Name</label>
          <input value={cust} onChange={e => setCust(e.target.value)} required style={{ width: "100%", padding: 6, boxSizing: "border-box" }} />
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Classification</label>
            <select value={type} onChange={e => setType(e.target.value)} style={{ width: "100%", padding: 6 }}>
              {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Business Stream</label>
            <select value={bus} onChange={e => setBus(e.target.value)} style={{ width: "100%", padding: 6 }}>
              {BUS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Project Owner</label>
            <input value={owner} onChange={e => setOwner(e.target.value)} style={{ width: "100%", padding: 6, boxSizing: "border-box" }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Allocated Fitter</label>
            <select value={alloc} onChange={e => setAlloc(e.target.value)} style={{ width: "100%", padding: 6 }}>
              <option value="">Unassigned</option>
              {people.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Target Completion</label>
            <input type="date" value={due} onChange={e => setDue(e.target.value)} style={{ width: "100%", padding: 6, boxSizing: "border-box" }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Est. Hours</label>
            <input type="number" step="0.5" value={hrs} onChange={e => setHrs(e.target.value)} style={{ width: "100%", padding: 6, boxSizing: "border-box" }} />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" onClick={onClose} style={{ padding: "6px 12px", background: "#EDF2F7", border: "none", borderRadius: 4, cursor: "pointer" }}>Cancel</button>
          <button type="submit" style={{ padding: "6px 12px", background: COLORS.orange, color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>Save Record</button>
        </div>
      </form>
    </div>
  );
}

function NotesPanel({ job, notes, allJobs, allMode, onClose, onAddNote }) {
  const [txt, setTxt] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!txt.trim()) return;
    onAddNote(allMode ? allJobs[0]?.id : job.id, txt.trim());
    setTxt("");
  };

  return (
    <div style={{ position: "fixed", top: 0, right: 0, width: 360, bottom: 0, background: "#fff", boxShadow: "-4px 0 20px rgba(0,0,0,0.1)", zIndex: 1000, display: "flex", flexDirection: "column", fontFamily: "sans-serif" }}>
      <div style={{ padding: 16, borderBottom: `1px solid ${COLORS.rule}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: COLORS.navy, color: "#fff" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{allMode ? "Central Update Thread" : `Job Discussion logs`}</div>
          <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{allMode ? "Viewing comments across all workshop entries" : `${job?.asm} - ${job?.cust}`}</div>
        </div>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#fff", fontSize: 16, cursor: "pointer" }}>✕</button>
      </div>

      <div style={{ flex: 1, padding: 16, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, background: "#F7FAFC" }}>
        {notes.length === 0 ? (
          <div style={{ textAlignment: "center", color: COLORS.textMid, fontSize: 11, padding: 20 }}>No logs recorded yet.</div>
        ) : (
          notes.map((n, i) => (
            <div key={i} style={{ background: "#fff", padding: 10, borderRadius: 6, border: `1px solid ${COLORS.rule}`, boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: COLORS.textMid, marginBottom: 4, fontWeight: 600 }}>
                <span>👤 {n.by}</span>
                <span>⏱️ {n.at}</span>
              </div>
              {allMode && <div style={{ fontSize: 9, background: COLORS.steelLt, color: COLORS.navy, padding: "2px 4px", borderRadius: 4, display: "inline-block", marginBottom: 4 }}>{n.jobCust} ({n.jobAsm})</div>}
              <div style={{ fontSize: 12, color: COLORS.textDark, lineHeight: "1.4" }}>{n.txt}</div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} style={{ padding: 12, borderTop: `1px solid ${COLORS.rule}`, background: "#fff" }}>
        <input value={txt} onChange={e => setTxt(e.target.value)} placeholder={allMode ? "Select a specific job on the board to add comments..." : "Type production update details here..."} disabled={allMode} style={{ width: "100%", padding: 8, borderRadius: 4, border: `1px solid ${COLORS.rule}`, fontSize: 12, boxSizing: "border-box", marginBottom: 6 }} />
        <button type="submit" disabled={allMode || !txt.trim()} style={{ width: "100%", background: COLORS.navy, color: "#fff", padding: 6, border: "none", borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: "pointer", opacity: (!txt.trim() || allMode) ? 0.5 : 1 }}>
          Post Internal Note
        </button>
      </form>
    </div>
  );
}

function LogsModal({ isOpen, onClose, jobs }) {
  if (!isOpen) return null;

  let allLogs = [];
  jobs.forEach(j => {
    if (j.notes) {
      try {
        const parsed = typeof j.notes === "string" ? JSON.parse(j.notes) : j.notes;
        if (Array.isArray(parsed)) {
          parsed.forEach(n => {
            allLogs.push({ ...n, jobAsm: j.asm, jobCust: j.cust, so: j.so });
          });
        }
      } catch(e){}
    }
  });
  
  allLogs.sort((a,b) => new Date(b.at) - new Date(a.at));

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000, fontFamily: "sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 8, width: 650, maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.2)" }}>
        <div style={{ padding: 16, background: COLORS.navy, color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Complete Production Audit Trail</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", fontSize: 16, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ flex: 1, padding: 16, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, background: "#F7FAFC" }}>
          {allLogs.length === 0 ? (
            <div style={{ textAlign: "center", color: COLORS.textMid, fontSize: 12, padding: 20 }}>No logs found in registry.</div>
          ) : (
            allLogs.map((l, idx) => (
              <div key={idx} style={{ background: "#fff", padding: 12, borderRadius: 6, border: `1px solid ${COLORS.rule}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.navy, marginBottom: 4 }}>
                    {l.jobCust} <span style={{ fontWeight: 400, color: COLORS.textMid }}>({l.jobAsm} / SO: {l.so})</span>
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.textDark }}>{l.txt}</div>
                </div>
                <div style={{ textAlignment: "right", minWidth: 110, fontSize: 10, color: COLORS.textMid }}>
                  <div style={{ fontWeight: 600 }}>👤 {l.by}</div>
                  <div style={{ fontSize: 9, marginTop: 2 }}>⏱️ {l.at}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}