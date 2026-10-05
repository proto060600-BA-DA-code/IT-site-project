import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import BlockRenderer from "@/components/blocks";
import { useSettings } from "@/contexts/SettingsContext";

/**
 * The homepage is composed from a saved block layout (Admin → Page builder).
 *
 * DEFAULT_LAYOUT mirrors the original hardcoded page and is used whenever no
 * layout has been saved — so the site renders identically out of the box, and
 * a bad save can never leave the homepage blank.
 */
const DEFAULT_LAYOUT = [
  { id: "d-hero", type: "hero", props: {} },
  { id: "d-trusted", type: "trusted_by", props: {} },
  { id: "d-caps", type: "capabilities", props: {} },
  { id: "d-banner", type: "banner", props: {} },
  { id: "d-cats", type: "category_tree", props: {} },
  { id: "d-services", type: "services_carousel", props: {} },
  { id: "d-why", type: "why_us", props: {} },
  { id: "d-lead", type: "lead_form", props: {} },
];

export default function Home() {
  const s = useSettings();
  const [banners, setBanners] = useState([]);
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [blocks, setBlocks] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get("/banners"),
      api.get("/services?featured=true"),
      api.get("/categories"),
    ]).then(([b, s, c]) => {
      setBanners(b.data);
      setServices(s.data);
      setCategories(c.data);
    }).catch(() => {});

    api.get("/layouts/home")
      .then((r) => setBlocks(r.data?.blocks?.length ? r.data.blocks : DEFAULT_LAYOUT))
      .catch(() => setBlocks(DEFAULT_LAYOUT));
  }, []);

  return (
    <div data-testid="home-page">
      <BlockRenderer
        blocks={blocks || DEFAULT_LAYOUT}
        ctx={{ banners, services, categories }}
      />

      {/* JSON-LD Organization — read from Site settings, so the email and
          phone here can never disagree with the footer. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ProfessionalService",
          "name": s.brand_name,
          "description": s.footer_description,
          "areaServed": "IN",
          "address": { "@type": "PostalAddress", "addressLocality": s.address, "addressCountry": "IN" },
          "telephone": s.phone,
          "email": s.email,
        }).replace(/</g, "\\u003c") }}
      />
    </div>
  );
}
