import { createBrowserRouter, Navigate } from "react-router-dom";

import AdminLayout from "./layout/AdminLayout";
import RequireAuth from "./components/RequireAuth";
import { ADMIN_LAYOUT_ROLES, ADMIN_ROLES } from "./utils/permissions";

import DashboardPage from "./pages/DashboardPage";
import VehiclePage from "./pages/VehiclePage";
import DriverPage from "./pages/DriverPage";
import TransportSchedulePage from "./pages/TransportSchedulePage";
import SchedulePage from "./pages/SchedulePage";
import NotificationsPage from "./pages/NotificationsPage";
import VehicleDetailsPage from "./pages/VehicleDetailsPage";
import RequisitionsPage from "./pages/RequisitionsPage";
import UsersPage from "./pages/UsersPage";
import ApplyRequisitionPage from "./pages/ApplyRequisitionPage";
import MyRequisitionsPage from "./pages/MyRequisitionsPage";
import MyMileagePage from "./pages/MyMileagePage";

import RecommenderInboxPage from "./pages/recommender/RecommenderInboxPage";
import RecommenderRequisitionDetailPage from "./pages/recommender/RecommenderRequisitionDetailPage";

import RegisterPage from "./pages/auth/RegisterPage";
import OtpPage from "./pages/auth/OtpPage";
import ProfileSetupPage from "./pages/auth/ProfileSetupPage";
import LoginPage from "./pages/auth/LoginPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/login" replace />,
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/register",
    element: <RegisterPage />,
  },
  {
    path: "/otp",
    element: <OtpPage />,
  },
  {
    path: "/profile-setup",
    element: (
      <RequireAuth>
        <ProfileSetupPage />
      </RequireAuth>
    ),
  },
  {
    path: "/apply",
    element: (
      <RequireAuth>
        <ApplyRequisitionPage />
      </RequireAuth>
    ),
  },
  {
    path: "/my-requisitions",
    element: (
      <RequireAuth>
        <MyRequisitionsPage />
      </RequireAuth>
    ),
  },
  {
    path: "/my-mileage",
    element: (
      <RequireAuth>
        <MyMileagePage />
      </RequireAuth>
    ),
  },
  {
    path: "/admin",
    element: (
      <RequireAuth roles={ADMIN_LAYOUT_ROLES}>
        <AdminLayout />
      </RequireAuth>
    ),
    children: [
      {
        // Shared landing page for everyone under the /admin shell.
        index: true,
        element: <DashboardPage />,
      },
      {
        path: "vehicle",
        element: (
          <RequireAuth roles={ADMIN_ROLES}>
            <VehiclePage />
          </RequireAuth>
        ),
      },
      {
        path: "driver",
        element: (
          <RequireAuth roles={ADMIN_ROLES}>
            <DriverPage />
          </RequireAuth>
        ),
      },
      {
        path: "transport-schedule",
        element: (
          <RequireAuth roles={ADMIN_ROLES}>
            <TransportSchedulePage />
          </RequireAuth>
        ),
      },
      {
        path: "schedule",
        element: (
          <RequireAuth roles={ADMIN_ROLES}>
            <SchedulePage />
          </RequireAuth>
        ),
      },
      {
        path: "requisitions",
        element: (
          <RequireAuth roles={ADMIN_ROLES}>
            <RequisitionsPage />
          </RequireAuth>
        ),
      },
      {
        // Phase 9 — Super Admin console. Narrower than the shared
        // ADMIN_ROLES guard every other admin page uses: this page is
        // genuinely Super-Admin-exclusive (account activation, role
        // reassignment), not just Transport-Office-staff-shared.
        path: "users",
        element: (
          <RequireAuth roles={["SuperAdmin"]}>
            <UsersPage />
          </RequireAuth>
        ),
      },
      {
        // Left open to the whole /admin shell (admin roles + DepartmentHead)
        // since recommenders get their own notifications too.
        path: "notifications",
        element: <NotificationsPage />,
      },
      {
        path: "vehicle/:vehicleId",
        element: (
          <RequireAuth roles={ADMIN_ROLES}>
            <VehicleDetailsPage />
          </RequireAuth>
        ),
      },
      {
        path: "recommender",
        element: (
          <RequireAuth roles={["DepartmentHead"]}>
            <RecommenderInboxPage />
          </RequireAuth>
        ),
      },
      {
        path: "recommender/:requisitionId",
        element: (
          <RequireAuth roles={["DepartmentHead"]}>
            <RecommenderRequisitionDetailPage />
          </RequireAuth>
        ),
      },
    ],
  },
]);

export default router;
