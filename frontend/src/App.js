import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";

import { AuthProvider } from "@/contexts/AuthContext";
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
import AdminCategories from "@/pages/admin/AdminCategories";
import AdminServices from "@/pages/admin/AdminServices";
import AdminPages from "@/pages/admin/AdminPages";
import AdminPosts from "@/pages/admin/AdminPosts";
import AdminLeads from "@/pages/admin/AdminLeads";
import { useEffect } from "react";

const PAGE_TITLES = {
  "/": "AI, Software & Digital Transformation",
  "/services": "Services",
  "/about": "About",
  "/contact": "Contact",
  "/insights": "Insights",
  "/privacy": "Privacy Policy",
  "/terms": "Terms & Conditions",
  "/login": "Sign in",
  "/register": "Create account",
};

function Layout({ children }) {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const isAuth = location.pathname === "/login" || location.pathname === "/register";

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    // Per-page browser tab title. Detail pages (service/post/category) can still
    // override this with a more specific title once their data loads.
    const t = isAdmin
      ? "Admin · RK AI Labs"
      : PAGE_TITLES[location.pathname]
      ? `${PAGE_TITLES[location.pathname]} · RK AI Labs`
      : "RK AI Labs — AI, Software & Digital Transformation";
    document.title = t;
  }, [location.pathname, isAdmin]);

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
        <Route path="/about" element={<CmsPage slug="about" fallbackTitle="About RK AI Labs" fallbackContent="Loading…" />} />
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
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster position="top-right" />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
