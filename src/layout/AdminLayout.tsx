import { Outlet } from "react-router-dom";

import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

function AdminLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC]">
      <Navbar title="SUST Transit Admin" administrator="Dr. Khalidur Rahman" />

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