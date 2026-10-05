import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { BRAND } from "@/lib/brand";

/**
 * Site-wide editable copy. Falls back to the compiled-in BRAND constants so
 * the header and footer still render correctly if the API is unreachable or
 * settings have never been saved.
 */
const FALLBACK = {
  announcement_enabled: true,
  announcement_left: "Business Analysis • AI Solutions • Digital Transformation",
  announcement_right: "Free Discovery Call Available",
  logo_title: BRAND.name,
  logo_subtitle: "Business & AI Solutions",
  header_cta_label: "Book a consultation →",
  header_cta_link: "/contact",
  footer_description:
    "IT Business Analysis solutions and AI product building. From requirements and process discovery to shipped AI products and automations.",
  footer_links_heading: "Quick Links",
  footer_contact_heading: "Contact Info",
  footer_legal: "© 2026 Synferrous · All rights reserved",
  footer_locale: "Delhi NCR · India",
  brand_name: BRAND.name,
  tagline: BRAND.tagline,
  phone: BRAND.phone,
  email: BRAND.email,
  address: BRAND.address,
  founded: BRAND.founded,
  linkedin: BRAND.linkedin,
  x: BRAND.x,
  // Off until the backend confirms the assistant is configured — a visitor
  // should never meet a chat widget that can't answer.
  chat_enabled: false,
  grievance_officer_name: "",
  grievance_officer_email: "",
  consent_text: "",
};

const SettingsContext = createContext(FALLBACK);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(FALLBACK);

  useEffect(() => {
    api
      .get("/settings")
      .then((r) => setSettings({ ...FALLBACK, ...(r.data || {}) }))
      .catch(() => {}); // keep the fallback
  }, []);

  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);
