import { Outlet } from "react-router-dom";

import useAuth from "../hooks/useAuth";
import ApplicantHeader from "../components/ApplicantHeader";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

function AdminLayout() {
  const { currentUser } = useAuth();

  // Department / Office Heads get the same top bar as the applicant pages
  // on every screen they use (Dashboard, Request, New Requisition…), with
  // no left sidebar, so the navigation never jumps between top and left.
  if (currentUser?.role === "DepartmentHead") {
    return (
      <div className="min-h-screen bg-surface">
        <ApplicantHeader />
        <main className="mx-auto max-w-6xl p-6">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <Navbar title="SUST Transit Admin" />

      <div className="flex flex-1">
        <Sidebar />

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;

// Think Outlet as:
// "Put the currently matched child route here."
