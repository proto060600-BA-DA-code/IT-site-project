import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";

import { AuthProvider } from "@/contexts/AuthContext";
import { SettingsProvider, useSettings } from "@/contexts/SettingsContext";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ChatWidget from "@/components/ChatWidget";

import Home from "@/pages/Home";
import ServicesPLP from "@/pages/ServicesPLP";
import ServicePDP from "@/pages/ServicePDP";
import CategoryPage from "@/pages/CategoryPage";
import CmsPage from "@/pages/CmsPage";
import Contact from "@/pages/Contact";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import InsightsList from "@/pages/InsightsList";
import InsightDetail from "@/pages/InsightDetail";
import NotFound from "@/pages/NotFound";

import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminBanners from "@/pages/admin/AdminBanners";
import AdminClients from "@/pages/admin/AdminClients";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminRoles from "@/pages/admin/AdminRoles";
import AdminMedia from "@/pages/admin/AdminMedia";
import AdminPageBuilder from "@/pages/admin/AdminPageBuilder";
import AdminSettings from "@/pages/admin/AdminSettings";
import AdminAudit from "@/pages/admin/AdminAudit";
import AdminCategories from "@/pages/admin/AdminCategories";
import AdminServices from "@/pages/admin/AdminServices";
import AdminPages from "@/pages/admin/AdminPages";
import AdminPosts from "@/pages/admin/AdminPosts";
import AdminLeads from "@/pages/admin/AdminLeads";
import { useEffect } from "react";

// Static pages only. Detail pages (service, category, post, CMS page) set
// their own title via usePageTitle once their data loads.
const PAGE_TITLES = {
  "/services": "Services",
  "/contact": "Contact",
  "/insights": "Insights",
  "/login": "Sign in",
  "/register": "Create account",
};

function Layout({ children }) {
  const location = useLocation();
  const { brand_name, tagline } = useSettings();
  const isAdmin = location.pathname.startsWith("/admin");
  const isAuth = location.pathname === "/login" || location.pathname === "/register";

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);

  // Same formats as the server-side head in routes_seo.py, from Site settings,
  // so the title never changes between the HTML and the rendered page.
  useEffect(() => {
    const path = location.pathname;
    if (isAdmin) document.title = `Admin · ${brand_name}`;
    else if (path === "/") document.title = tagline ? `${brand_name} — ${tagline}` : brand_name;
    else if (PAGE_TITLES[path]) document.title = `${PAGE_TITLES[path]} · ${brand_name}`;
    // Anything else is a detail page, which sets its own title.
  }, [location.pathname, isAdmin, brand_name, tagline]);

  return (
    <div className="App min-h-screen flex flex-col">
      {!isAdmin && <Header />}
      <div className="flex-1">{children}</div>
      {!isAdmin && !isAuth && <Footer />}
      {!isAdmin && <ChatWidget />}
    </div>
  );
}

function AppRoutes() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/services" element={<ServicesPLP />} />
        <Route path="/services/:slug" element={<ServicePDP />} />
        <Route path="/categories/:slug" element={<CategoryPage />} />
        <Route path="/about" element={<CmsPage slug="about" fallbackTitle="About Synferrous" fallbackContent="Loading…" />} />
        <Route path="/privacy" element={<CmsPage slug="privacy" fallbackTitle="Privacy Policy" fallbackContent="Loading…" />} />
        <Route path="/terms" element={<CmsPage slug="terms" fallbackTitle="Terms & Conditions" fallbackContent="Loading…" />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/insights" element={<InsightsList />} />
        <Route path="/insights/:slug" element={<InsightDetail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="banners" element={<AdminBanners />} />
          <Route path="clients" element={<AdminClients />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="services" element={<AdminServices />} />
          <Route path="pages" element={<AdminPages />} />
          <Route path="posts" element={<AdminPosts />} />
          <Route path="leads" element={<AdminLeads />} />
          <Route path="media" element={<AdminMedia />} />
          <Route path="page-builder" element={<AdminPageBuilder />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="roles" element={<AdminRoles />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="audit" element={<AdminAudit />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster position="top-right" />
        </BrowserRouter>
      </SettingsProvider>
    </AuthProvider>
  );
}

export default App;
