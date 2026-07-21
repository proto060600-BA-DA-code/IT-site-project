import AdminCRUD from "./AdminCRUD";

export default function AdminPosts() {
  return (
    <AdminCRUD
      resource="posts"
      title="Posts"
      testidPrefix="post"
      imageFolder="blog"
      columns={[
        { key: "title", label: "Title" },
        { key: "slug", label: "Slug" },
        { key: "author", label: "Author" },
        { key: "status", label: "Status" },
        { key: "tags", label: "Tags" },
      ]}
      fields={[
        { key: "title", label: "Title" },
        { key: "slug", label: "Slug" },
        { key: "excerpt", label: "Excerpt", type: "textarea", rows: 2 },
        { key: "cover_image", label: "Cover image", type: "image" },
        { key: "author", label: "Author" },
        { key: "tags", label: "Tags", type: "array", helper: "one per line" },
        { key: "read_time_min", label: "Read time (minutes)", type: "number" },
        { key: "meta_description", label: "Meta description", type: "textarea", rows: 2 },
        { key: "body", label: "Body (Markdown)", type: "textarea", rows: 18 },
        { key: "status", label: "Status", type: "select", options: ["draft", "published"] },
      ]}
      defaults={{
        title: "", slug: "", excerpt: "", cover_image: "", author: "RK AI Labs Team",
        tags: "", read_time_min: 5, meta_description: "", body: "", status: "draft",
      }}
    />
  );
}
