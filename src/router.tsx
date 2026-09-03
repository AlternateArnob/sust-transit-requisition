import { createBrowserRouter, Navigate } from "react-router-dom";

import AdminLayout from "./layout/AdminLayout";
import RequireAuth from "./components/RequireAuth";

import DashboardPage from "./pages/DashboardPage";
import VehiclePage from "./pages/VehiclePage";
import DriverPage from "./pages/DriverPage";
import RoutesPage from "./pages/RoutesPage";
import SchedulePage from "./pages/SchedulePage";
import AllocationPage from "./pages/AllocationPage";
import NotificationsPage from "./pages/NotificationsPage";
import VehicleDetailsPage from "./pages/VehicleDetailsPage";
import RequisitionsPage from "./pages/RequisitionsPage";
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
      <RequireAuth roles={["Admin", "DepartmentHead"]}>
        <AdminLayout />
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: "vehicle",
        element: <VehiclePage />,
      },
      {
        path: "driver",
        element: <DriverPage />,
      },
      {
        path: "routes",
        element: <RoutesPage />,
      },
      {
        path: "schedule",
        element: <SchedulePage />,
      },
      {
        path: "requisitions",
        element: <RequisitionsPage />,
      },
      {
        path: "allocation",
        element: <AllocationPage />,
      },
      {
        path: "notifications",
        element: <NotificationsPage />,
      },
      {
        path: "vehicle/:vehicleId",
        element: <VehicleDetailsPage />,
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
