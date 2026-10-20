import AdminLayout from "./layout/AdminLayout";

function App() {
  return (
    <AdminLayout>
      <div>
        <h2 className="text-2xl font-bold text-[#1E293B]">Dashboard</h2>

        <p className="mt-1 text-sm text-[#64748B]">
          Transport administration overview
        </p>
      </div>
    </AdminLayout>
  );
}

export default App;