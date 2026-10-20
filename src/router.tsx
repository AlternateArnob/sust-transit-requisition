import { createBrowserRouter, Navigate } from "react-router-dom";

import AdminLayout from "./layout/AdminLayout";
import RequireAuth from "./components/RequireAuth";
import { ADMIN_LAYOUT_ROLES } from "./utils/permissions";

import DashboardPage from "./pages/DashboardPage";
import VehiclePage from "./pages/VehiclePage";
import DriverPage from "./pages/DriverPage";
import TransportSchedulePage from "./pages/TransportSchedulePage";
import SchedulePage from "./pages/SchedulePage";
import NotificationsPage from "./pages/NotificationsPage";
import VehicleDetailsPage from "./pages/VehicleDetailsPage";
import RequisitionsPage from "./pages/RequisitionsPage";
import UsersPage from "./pages/UsersPage";
import ProfilePage from "./pages/ProfilePage";
import ApplyRequisitionPage from "./pages/ApplyRequisitionPage";
import ApplicantDashboardPage from "./pages/ApplicantDashboardPage";
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
    // Step 9 — applicant landing page after login, restricted to the
    // Applicant role the same way /admin/users is restricted to
    // SuperAdmin: this page's stats/shortcuts only make sense for an
    // applicant's own requisitions, not the Transport Office roles or
    // DepartmentHead (who both land on /admin instead — see LoginPage).
    path: "/dashboard",
    element: (
      <RequireAuth roles={["Applicant"]}>
        <ApplicantDashboardPage />
      </RequireAuth>
    ),
  },
  {
    // Step 10 — applicants have no /admin access, so they need their own
    // top-level route to the same NotificationsPage the admin shell
    // uses (it's already generic over useNotifications()'s per-user
    // filtering, so no separate page is needed — just a route an
    // Applicant can actually reach).
    path: "/notifications",
    element: (
      <RequireAuth roles={["Applicant"]}>
        <NotificationsPage />
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
        // Corrections Step 3 — TIC-only per the corrected requirements
        // (Super Admin and Transport Administrator no longer manage
        // vehicles/drivers/schedule at all, not just "don't see the nav
        // link for it"). Narrowed from the shared ADMIN_ROLES guard.
        path: "vehicle",
        element: (
          <RequireAuth roles={["TransportInCharge"]}>
            <VehiclePage />
          </RequireAuth>
        ),
      },
      {
        path: "driver",
        element: (
          <RequireAuth roles={["TransportInCharge"]}>
            <DriverPage />
          </RequireAuth>
        ),
      },
      {
        path: "transport-schedule",
        element: (
          <RequireAuth roles={["TransportInCharge"]}>
            <TransportSchedulePage />
          </RequireAuth>
        ),
      },
      {
        path: "schedule",
        element: (
          <RequireAuth roles={["TransportInCharge"]}>
            <SchedulePage />
          </RequireAuth>
        ),
      },
      {
        // Corrections Step 3 — Super Admin dropped; requisitions is now
        // TIC + Transport Administrator only, matching "Super Admin's
        // only surface is accounts."
        path: "requisitions",
        element: (
          <RequireAuth roles={["TransportInCharge", "TransportAdministrator"]}>
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
        // Corrections Step 2 — self-service profile edit, open to the
        // whole /admin shell like notifications: every role that has a
        // navbar dropdown to reach this from should be able to use it.
        path: "profile",
        element: <ProfilePage />,
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
          <RequireAuth roles={["TransportInCharge"]}>
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
