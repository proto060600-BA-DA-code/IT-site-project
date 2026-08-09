import MediaLibrary from "@/components/admin/MediaLibrary";

export default function AdminMedia() {
  return (
    <div data-testid="admin-media-page">
      <div className="mb-6">
        <div className="eyebrow mb-2">Manage</div>
        <h1 className="text-3xl tracking-tight">Media</h1>
        <p className="text-sm text-[var(--ink-soft)] mt-1">
          Drop files anywhere on this panel to upload. Anything here can be reused from any image field.
        </p>
      </div>
      <MediaLibrary selectable />
    </div>
  );
}
