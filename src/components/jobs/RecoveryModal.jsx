import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import { useAuthCtx } from "../../state/AuthProvider";
import { Modal, ModalHeader } from "../ui/overlay";
import { Button, Field, Input } from "../ui/primitives";

// Shown when Supabase fires a PASSWORD_RECOVERY event.
export function RecoveryModal() {
  const { user, recovery, setRecovery } = useAuthCtx();
  const open = Boolean(recovery && user && supabase);

  const submit = async (e) => {
    e.preventDefault();
    const pw = e.target.elements.newpw.value;
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) toast.error(error.message);
    else { toast.success("Password updated. You are signed in."); setRecovery(false); }
  };

  return (
    <Modal open={open} onClose={() => setRecovery(false)} size="sm">
      <form onSubmit={submit}>
        <ModalHeader eyebrow="Password recovery" title="Set a new password" onClose={() => setRecovery(false)} />
        <div className="p-6">
          <Field label="New password (min 8 characters)"><Input name="newpw" type="password" minLength={8} required /></Field>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--line)] bg-[var(--surface-card)] px-6 py-4">
          <Button type="button" variant="subtle" onClick={() => setRecovery(false)}>Cancel</Button>
          <Button type="submit" variant="primary">Update password</Button>
        </div>
      </form>
    </Modal>
  );
}
