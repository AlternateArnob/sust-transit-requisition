import { createBrowserRouter } from "react-router-dom";

import AdminLayout from "./layout/AdminLayout";

import DashboardPage from "./pages/DashboardPage";
import FleetPage from "./pages/FleetPage";
import StaffPage from "./pages/StaffPage";
import RoutesPage from "./pages/RoutesPage";
import SchedulePage from "./pages/SchedulePage";
import AllocationPage from "./pages/AllocationPage";
import ConflictsPage from "./pages/ConflictsPage";
import NotificationsPage from "./pages/NotificationsPage";
import MileagePage from "./pages/MileagePage";
import VehicleDetailsPage from "./pages/VehicleDetailsPage";
import RequisitionsPage from "./pages/RequisitionsPage";
import ApplyRequisitionPage from "./pages/ApplyRequisitionPage";

const router = createBrowserRouter([
  {
    path: "/apply",
    element: <ApplyRequisitionPage />,
  },
  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: "fleet",
        element: <FleetPage />,
      },
      {
        path: "staff",
        element: <StaffPage />,
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
        path: "conflicts",
        element: <ConflictsPage />,
      },
      {
        path: "notifications",
        element: <NotificationsPage />,
      },
      {
        path: "mileage",
        element: <MileagePage />,
      },
      {
        path: "fleet/:vehicleId",
        element: <VehicleDetailsPage />,
      },
    ],
  },
]);

export default router;

// When URL is this
//        ↓
// render this component
