import { createBrowserRouter } from "react-router-dom";

import AdminLayout from "@/app/layout/AdminLayout";
import RequireAuth from "@/features/auth/components/RequireAuth";
import { ADMIN_LAYOUT_ROLES } from "@/shared/utils/permissions";

import DashboardPage from "@/features/dashboard/pages/DashboardPage";
import VehiclePage from "@/features/fleet/pages/VehiclePage";
import DriverPage from "@/features/fleet/pages/DriverPage";
import TransportSchedulePage from "@/features/fleet/pages/TransportSchedulePage";
import SchedulePage from "@/features/fleet/pages/SchedulePage";
import NotificationsPage from "@/features/notifications/pages/NotificationsPage";
import VehicleDetailsPage from "@/features/fleet/pages/VehicleDetailsPage";
import RequisitionsPage from "@/features/requisitions/pages/RequisitionsPage";
import UsersPage from "@/features/users/pages/UsersPage";
import ProfilePage from "@/features/users/pages/ProfilePage";
import ApplyRequisitionPage from "@/features/requisitions/pages/ApplyRequisitionPage";
import ApplicantDashboardPage from "@/features/dashboard/pages/ApplicantDashboardPage";
import MyRequisitionsPage from "@/features/requisitions/pages/MyRequisitionsPage";
import MyMileagePage from "@/features/mileage/pages/MyMileagePage";

import RecommenderInboxPage from "@/features/requisitions/pages/recommender/RecommenderInboxPage";
import RecommendedByMePage from "@/features/requisitions/pages/recommender/RecommendedByMePage";
import RecommenderRequisitionDetailPage from "@/features/requisitions/pages/recommender/RecommenderRequisitionDetailPage";

import RegisterPage from "@/features/auth/pages/RegisterPage";
import OtpPage from "@/features/auth/pages/OtpPage";
import ProfileSetupPage from "@/features/auth/pages/ProfileSetupPage";
import LoginPage from "@/features/auth/pages/LoginPage";
import LandingPage from "@/features/landing/pages/LandingPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <LandingPage />,
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
    // Applicant landing page after login, restricted to the
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
    // Applicants have no /admin access, so they need their own
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
        // TIC-only per the corrected requirements
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
        // Super Admin dropped; requisitions is now
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
        // Super Admin console. Narrower than the shared
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
        // Self-service profile edit, open to the
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
        path: "recommender/history",
        element: (
          <RequireAuth roles={["DepartmentHead"]}>
            <RecommendedByMePage />
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
