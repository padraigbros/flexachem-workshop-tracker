import { createContext, useContext, useState, useCallback } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Plus } from "lucide-react";
import { useAuthCtx } from "../../state/AuthProvider";
import { useWorkshop } from "../../state/WorkshopProvider";
import { useJobDrawer } from "../../state/useJobDrawer";
import { uploadJobPdf } from "../../lib/files";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { Topbar } from "./Topbar";
import { CommandPalette } from "./CommandPalette";
import { JobDrawer } from "../jobs/JobDrawer";
import { UpdatesDrawer } from "../jobs/UpdatesDrawer";
import { JobModal } from "../jobs/JobModal";
import { ConfirmDialog } from "../ui/overlay";

// Lets any view open the edit modal or a delete confirmation without prop-drilling.
const ShellContext = createContext(null);
export function useShell() { return useContext(ShellContext); }

export function AppShell() {
  const location = useLocation();
  const reduce = useReducedMotion();
  const { user, isAdmin } = useAuthCtx();
  const shop = useWorkshop();
  const { jobId, panel, openJob, closeJob, openUpdates, closePanel } = useJobDrawer();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const newJob = useCallback(() => setEditingJob({}), []);
  const editJob = useCallback((job) => setEditingJob(job), []);
  const askDelete = useCallback((job) => setConfirm(job), []);

  const shellValue = { newJob, editJob, askDelete, openJob };
  const selectedJob = jobId ? shop.getJob(jobId) : null;

  const saveJob = async (fieldsIn) => {
    const { attachmentFile, attachment: keptAttachment, ...rest } = fieldsIn;
    let attachment = keptAttachment || null;
    let label;
    if (attachmentFile) {
      attachment = await uploadJobPdf(attachmentFile, shop.auditBy);
      label = `Attached ${attachmentFile.name}`;
    } else if (editingJob.id && editingJob.attachment && !attachment) {
      label = "Attachment removed";
    }
    if (editingJob.id) await shop.auditPatch(editingJob.id, { ...rest, attachment }, label);
    else await shop.createJob({ ...rest, attachment }, attachmentFile?.name);
    setEditingJob(null);
  };

  return (
    <ShellContext.Provider value={shellValue}>
      <div className="grid min-h-[100dvh] grid-cols-1 lg:grid-cols-[272px_minmax(0,1fr)]">
        <Sidebar />
        <div className="flex min-w-0 flex-col">
          <Topbar onNewJob={newJob} onOpenPalette={() => setPaletteOpen(true)} />
          <main className="flex-1 px-4 pb-28 pt-5 sm:px-6 lg:pb-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        <MobileNav />

        {/* Mobile FAB — admins only */}
        {isAdmin && (
          <button
            onClick={newJob}
            aria-label="Log new job"
            className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-[75] grid h-14 w-14 place-items-center rounded-2xl text-white shadow-[0_16px_36px_rgb(242_106_33/0.42)] transition-transform active:scale-90 lg:hidden"
            style={{ background: "linear-gradient(135deg, var(--color-brand-500), var(--color-brand-400))" }}
          >
            <Plus size={26} />
          </button>
        )}
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onNewJob={newJob} />

      <JobDrawer
        job={selectedJob}
        open={Boolean(selectedJob)}
        user={user}
        onClose={closeJob}
        onEdit={isAdmin && selectedJob ? () => editJob(selectedJob) : null}
        onStatus={shop.auditPatch}
        onAddNote={shop.addNote}
      />

      <UpdatesDrawer
        updates={shop.updates}
        open={panel === "updates"}
        onClose={closePanel}
        onSelect={(id) => openJob(id)}
      />

      {editingJob && isAdmin && (
        <JobModal
          job={editingJob}
          open
          people={shop.activePeople}
          jobTypes={shop.activeJobTypes}
          businessUnits={shop.businessUnits}
          onClose={() => setEditingJob(null)}
          onSave={saveJob}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        title="Delete this job?"
        message={confirm ? `${confirm.asm || confirm.cust} will be archived with its history and can be restored from the Master List.` : ""}
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!confirm) return;
          await shop.auditPatch(confirm.id, { deleted: true }, "Job deleted");
          if (jobId === confirm.id) closeJob();
        }}
        onClose={() => setConfirm(null)}
      />
    </ShellContext.Provider>
  );
}
