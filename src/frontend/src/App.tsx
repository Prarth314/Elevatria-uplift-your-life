import { Toaster } from "@/components/ui/sonner";
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import Admin from "./pages/Admin";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";

// ─── Routes ───────────────────────────────────────────────────────────────────

const rootRoute = createRootRoute({
  component: () => (
    <div className="relative min-h-screen">
      {/* Animated aura background blobs */}
      <div className="aura-blob aura-blob-1" aria-hidden="true" />
      <div className="aura-blob aura-blob-2" aria-hidden="true" />
      <div className="aura-blob aura-blob-3" aria-hidden="true" />
      <div className="relative z-10">
        <Outlet />
      </div>
      <Toaster />
    </div>
  ),
});

const landingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Landing,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  component: Dashboard,
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: Admin,
});

const routeTree = rootRoute.addChildren([
  landingRoute,
  dashboardRoute,
  adminRoute,
]);

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  return <RouterProvider router={router} />;
}
