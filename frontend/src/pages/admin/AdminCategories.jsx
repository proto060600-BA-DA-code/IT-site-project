import AdminCRUD from "./AdminCRUD";

export default function AdminCategories() {
  return (
    <AdminCRUD
      resource="categories"
      title="Categories"
      testidPrefix="category"
      columns={[
        { key: "name", label: "Name" },
        { key: "slug", label: "Slug" },
        { key: "order", label: "Order" },
        { key: "active", label: "Status" },
      ]}
      fields={[
        { key: "name", label: "Name" },
        { key: "slug", label: "Slug", helper: "kebab-case, unique" },
        { key: "description", label: "Description", type: "textarea", rows: 2 },
        { key: "parent_id", label: "Parent ID", helper: "optional — for nested tree" },
        { key: "order", label: "Order", type: "number" },
        { key: "active", label: "Active", type: "boolean" },
      ]}
      defaults={{ name: "", slug: "", description: "", parent_id: "", order: 0, active: true }}
    />
  );
}
