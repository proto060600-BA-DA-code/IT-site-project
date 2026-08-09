import { api } from "@/lib/api";
import { toast } from "sonner";

/**
 * Fetch a CSV from an authenticated admin endpoint and save it.
 *
 * A plain <a download> can't be used here: the export routes sit behind the
 * Bearer token, so the file has to come through axios and then be handed to
 * the browser as a blob.
 */
export async function downloadCsv(path, fallbackName = "export.csv") {
  try {
    const res = await api.get(path, { responseType: "blob" });

    // Prefer the filename the server set, so exports carry their date stamp.
    let name = fallbackName;
    const disp = res.headers?.["content-disposition"];
    const match = disp && /filename="?([^";]+)"?/.exec(disp);
    if (match) name = match[1];

    const url = window.URL.createObjectURL(new Blob([res.data], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    toast.success(`Downloaded ${name}`);
  } catch (e) {
    toast.error(e?.response?.data?.detail || "Export failed");
  }
}
