import AdminCRUD from "./AdminCRUD";

export default function AdminPages() {
  return (
    <AdminCRUD
      resource="pages"
      title="Pages"
      testidPrefix="page"
      columns={[
        { key: "slug", label: "Slug" },
        { key: "title", label: "Title" },
        { key: "meta_description", label: "Meta" },
      ]}
      fields={[
        { key: "slug", label: "Slug" },
        { key: "title", label: "Title" },
        { key: "meta_description", label: "Meta description", type: "textarea", rows: 2 },
        { key: "content", label: "Content (Markdown)", type: "textarea", rows: 14 },
      ]}
      defaults={{ slug: "", title: "", meta_description: "", content: "" }}
    />
  );
}
