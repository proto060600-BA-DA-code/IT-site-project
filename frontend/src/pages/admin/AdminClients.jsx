import AdminCRUD from "./AdminCRUD";

export default function AdminClients() {
  return (
    <AdminCRUD
      resource="clients"
      title="Clients"
      testidPrefix="client"
      columns={[
        { key: "name", label: "Name" },
        { key: "website", label: "Website" },
        { key: "order", label: "Order" },
        { key: "active", label: "Status" },
      ]}
      fields={[
        { key: "name", label: "Client name", helper: "shown as a wordmark if no logo is uploaded" },
        { key: "logo_url", label: "Logo", type: "image" },
        { key: "website", label: "Website", helper: "optional — makes the logo clickable" },
        { key: "order", label: "Order", type: "number" },
        { key: "active", label: "Active", type: "boolean" },
      ]}
      defaults={{ name: "", logo_url: "", website: "", order: 0, active: true }}
      imageFolder="clients"
    />
  );
}
