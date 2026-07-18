// PDF attachment upload/open helpers. Errors surface through sonner toasts (replacing window.alert).
import { toast } from "sonner";
import { supabase, PDF_BUCKET } from "./supabase";

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

export async function uploadJobPdf(file, by) {
  const base = { name: file.name, size: file.size, uploadedAt: new Date().toISOString(), by: by || "" };
  if (supabase) {
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `jobs/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}/${safeName}`;
    const { error } = await supabase.storage.from(PDF_BUCKET).upload(path, file, { upsert: true, contentType: "application/pdf" });
    if (!error) return { ...base, path };
    toast.error("Cloud upload failed", { description: `${error.message}. The PDF will be kept in this browser only.` });
  }
  // Local fallback: base64 data URL stored with the job (large — cloud storage preferred).
  return { ...base, data: await fileToDataUrl(file) };
}

export async function openJobAttachment(att, { download = false } = {}) {
  const openUrl = (url) => {
    if (download) {
      const a = document.createElement("a");
      a.href = url;
      a.download = att.name || "attachment.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      window.open(url, "_blank", "noopener");
    }
  };
  try {
    if (att.path && supabase) {
      const options = download ? { download: att.name || true } : undefined;
      const { data, error } = await supabase.storage.from(PDF_BUCKET).createSignedUrl(att.path, 3600, options);
      if (error || !data?.signedUrl) throw error || new Error("No signed URL returned");
      openUrl(data.signedUrl);
      return;
    }
    if (att.data) {
      const blob = await (await fetch(att.data)).blob();
      const url = URL.createObjectURL(blob);
      openUrl(url);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return;
    }
    toast.error("Attachment is not available on this device.");
  } catch (err) {
    toast.error("Could not open attachment", { description: err?.message || String(err) });
  }
}
