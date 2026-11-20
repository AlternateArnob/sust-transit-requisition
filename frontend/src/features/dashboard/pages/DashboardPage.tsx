import useAuth from "@/features/auth/hooks/useAuth";
import { isTransportAdministrator, isSuperAdmin } from "@/shared/utils/permissions";

import SuperAdminDashboard from "@/features/dashboard/components/SuperAdminDashboard";
import TransportAdministratorDashboard from "@/features/dashboard/components/TransportAdministratorDashboard";
import TransportInChargeDashboard from "@/features/dashboard/components/TransportInChargeDashboard";

/**
 * This used to be one dashboard computing
 * vehicle/driver/requisition stats unconditionally for every
 * role. Now branches by role: each one only computes and shows what
 * that role can actually act on, rather than e.g. running vehicle/
 * driver queries for a Super Admin who can no longer see vehicles or
 * drivers at all.
 *
 * Transport In Charge's scope is unchanged from before this step, so
 * it's also the fallback for any role not explicitly Super Admin or
 * Transport Administrator (DepartmentHead lands here too, exactly as
 * it always has — splitting DepartmentHead's own dashboard wasn't part
 * of this correction, so it's deliberately left alone).
 */
export default function DashboardPage() {
  const { currentUser } = useAuth();

  if (isSuperAdmin(currentUser?.role)) {
    return <SuperAdminDashboard />;
  }

  if (isTransportAdministrator(currentUser?.role)) {
    return <TransportAdministratorDashboard />;
  }

  return <TransportInChargeDashboard />;
}
