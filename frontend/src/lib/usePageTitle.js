import { useEffect } from "react";
import { useSettings } from "@/contexts/SettingsContext";

/**
 * Set the browser tab title as "<title> · <brand>", matching the server-side
 * format in routes_seo.py. Matters for SEO, not just the tab: Google renders
 * JavaScript, so the title it indexes is the one set here.
 *
 * Pass a falsy title while data is loading — the previous title is kept
 * rather than flashing a generic one.
 */
export default function usePageTitle(title) {
  const { brand_name } = useSettings();
  useEffect(() => {
    if (title) document.title = `${title} · ${brand_name}`;
  }, [title, brand_name]);
}
