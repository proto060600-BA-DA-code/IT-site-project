import AdminCRUD from "./AdminCRUD";

export default function AdminServices() {
  return (
    <AdminCRUD
      resource="services"
      title="Services"
      testidPrefix="service"
      columns={[
        { key: "name", label: "Name" },
        { key: "slug", label: "Slug" },
        { key: "price_label", label: "Price" },
        { key: "featured", label: "Featured" },
        { key: "active", label: "Status" },
      ]}
      fields={[
        { key: "name", label: "Name" },
        { key: "slug", label: "Slug" },
        { key: "category_id", label: "Category ID", helper: "use Categories page to copy ID" },
        { key: "short_description", label: "Short description", type: "textarea", rows: 2 },
        { key: "long_description", label: "Long description", type: "textarea", rows: 6 },
        { key: "image_url", label: "Image", type: "image" },
        { key: "price_label", label: "Price label" },
        { key: "duration", label: "Duration" },
        { key: "features", label: "Features", type: "array", helper: "one per line" },
        { key: "deliverables", label: "Deliverables", type: "array", helper: "one per line" },
        { key: "featured", label: "Featured", type: "boolean" },
        { key: "active", label: "Active", type: "boolean" },
      ]}
      defaults={{
        name: "", slug: "", category_id: "", short_description: "", long_description: "",
        image_url: "", price_label: "Custom Quote", duration: "", features: "", deliverables: "",
        featured: false, active: true,
      }}
      imageFolder="services"
    />
  );
}
