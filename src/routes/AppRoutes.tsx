import { Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { lazyWithRetry } from "@/utils/lazyWithRetry";
import LocaleRouter from "@/components/LocaleRouter";

// ✅ OTIMIZAÇÃO CRÍTICA: Lazy load de ProtectedAdminRoute para evitar carregamento prematuro de Supabase
const ProtectedAdminRoute = lazyWithRetry(() => import("@/components/admin/ProtectedAdminRoute").then(m => ({ default: m.ProtectedAdminRoute })));

const AdminErrorBoundary = lazyWithRetry(() => import("@/components/AdminErrorBoundary").then(m => ({ default: m.AdminErrorBoundary })));

// ✅ OTIMIZAÇÃO CRÍTICA: Lazy load AdminLayout para não carregar 171 KiB na página inicial
const AdminLayout = lazyWithRetry(() => import("@/pages/admin/AdminLayout"));

const AdminDashboardRedirect = lazyWithRetry(() => import("@/components/admin/AdminDashboardRedirect"));

const AdminOrders = lazyWithRetry(() => import("@/pages/admin/AdminOrders"));
const AdminOrderDetails = lazyWithRetry(() => import("@/pages/admin/AdminOrderDetails"));
const AdminReactionVideos = lazyWithRetry(() => import("@/pages/admin/AdminReactionVideos"));
const AdminCollaborators = lazyWithRetry(() => import("@/pages/admin/AdminCollaborators"));
const AdminPayments = lazyWithRetry(() => import("@/pages/admin/AdminPayments"));
const AdminQuizMetrics = lazyWithRetry(() => import("@/pages/admin/AdminQuizMetrics"));
const AdminGenerate = lazyWithRetry(() => import("@/pages/admin/AdminGenerate"));
const AdminMedia = lazyWithRetry(() => import("@/pages/admin/AdminMedia"));
const AdminHotmartSync = lazyWithRetry(() => import("@/pages/admin/AdminHotmartSync"));
const AdminAuth = lazyWithRetry(() => import("@/pages/AdminAuth"));
const HotmartReturn = lazyWithRetry(() => import("@/pages/HotmartReturn"));
const SongDownload = lazyWithRetry(() => import("@/pages/SongDownload"));
const NotFound = lazyWithRetry(() => import("@/pages/NotFound"));
const Offline = lazyWithRetry(() => import("@/pages/admin/Offline"));

const AdminRouteFallback = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
  </div>
);

export const AppRoutes = () => {
  return (
    <Routes>
      <Route path="*" element={
        <LocaleRouter />
      } />
    
    <Route path="/admin/auth" element={
      <Suspense fallback={<AdminRouteFallback />}>
        <AdminAuth />
      </Suspense>
    } />
    
    <Route 
      path="/admin" 
      element={
        <Suspense fallback={<AdminRouteFallback />}>
          <AdminErrorBoundary>
            <AdminLayout />
          </AdminErrorBoundary>
        </Suspense>
      }
    >
      <Route index element={
        <Suspense fallback={<AdminRouteFallback />}>
          <AdminDashboardRedirect />
        </Suspense>
      } />
      <Route path="offline" element={
        <Suspense fallback={<AdminRouteFallback />}>
          <Offline />
        </Suspense>
      } />
      <Route path="orders" element={
        <Suspense fallback={<AdminRouteFallback />}>
          <ProtectedAdminRoute requiredPermission="orders">
            <AdminOrders />
          </ProtectedAdminRoute>
        </Suspense>
      } />
      <Route path="orders/:id" element={
        <Suspense fallback={<AdminRouteFallback />}>
          <ProtectedAdminRoute requiredPermission="orders">
            <AdminOrderDetails />
          </ProtectedAdminRoute>
        </Suspense>
      } />
      <Route path="payments" element={
        <Suspense fallback={<AdminRouteFallback />}>
          <ProtectedAdminRoute requiredPermission="orders">
            <AdminPayments />
          </ProtectedAdminRoute>
        </Suspense>
      } />
      <Route path="quiz-metrics" element={
        <Suspense fallback={<AdminRouteFallback />}>
          <ProtectedAdminRoute requiredPermission="dashboard">
            <AdminQuizMetrics />
          </ProtectedAdminRoute>
        </Suspense>
      } />
      <Route path="generate" element={
        <Suspense fallback={<AdminRouteFallback />}>
          <ProtectedAdminRoute requiredPermission="generate">
            <AdminGenerate />
          </ProtectedAdminRoute>
        </Suspense>
      } />
      <Route path="collaborators" element={
        <Suspense fallback={<AdminRouteFallback />}>
          <ProtectedAdminRoute requiredPermission="collaborators">
            <AdminCollaborators />
          </ProtectedAdminRoute>
        </Suspense>
      } />
      <Route path="reaction-videos" element={
        <Suspense fallback={<AdminRouteFallback />}>
          <ProtectedAdminRoute requiredPermission="reaction_videos">
            <AdminReactionVideos />
          </ProtectedAdminRoute>
        </Suspense>
      } />
      <Route path="media" element={
        <Suspense fallback={<AdminRouteFallback />}>
          <ProtectedAdminRoute requiredPermission="media">
            <AdminMedia />
          </ProtectedAdminRoute>
        </Suspense>
      } />
    </Route>
    
    <Route path="/app/admin/*" element={<Navigate to="/admin" replace />} />
    
    <Route path="/hotmart-return" element={
      <Suspense fallback={<AdminRouteFallback />}>
        <HotmartReturn />
      </Suspense>
    } />
    <Route path="/admin/hotmart-sync" element={
      <Suspense fallback={<AdminRouteFallback />}>
        <AdminHotmartSync />
      </Suspense>
    } />
    
    <Route path="/download/:id/:token" element={
      <Suspense fallback={<AdminRouteFallback />}>
        <SongDownload />
      </Suspense>
    } />
    <Route path="/download/:id" element={
      <Suspense fallback={<AdminRouteFallback />}>
        <SongDownload />
      </Suspense>
    } />
    
    <Route path="*" element={
      <Suspense fallback={<AdminRouteFallback />}>
        <NotFound />
      </Suspense>
    } />
    </Routes>
  );
};
