import AdminCRUD from "./AdminCRUD";

export default function AdminBanners() {
  return (
    <AdminCRUD
      resource="banners"
      title="Banners"
      testidPrefix="banner"
      columns={[
        { key: "title", label: "Title" },
        { key: "cta_label", label: "CTA" },
        { key: "order", label: "Order" },
        { key: "active", label: "Status" },
      ]}
      fields={[
        { key: "title", label: "Title" },
        { key: "subtitle", label: "Subtitle", type: "textarea", rows: 2 },
        { key: "image_url", label: "Image", type: "image" },
        { key: "cta_label", label: "CTA label" },
        { key: "cta_link", label: "CTA link" },
        { key: "order", label: "Order", type: "number" },
        { key: "active", label: "Active", type: "boolean" },
      ]}
      defaults={{ title: "", subtitle: "", image_url: "", cta_label: "", cta_link: "", order: 0, active: true }}
      imageFolder="banners"
    />
  );
}
