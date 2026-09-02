import NotificationBell from "../components/NotificationBell";

interface NavbarProps {
  title: string;
  administrator: string;
}

function Navbar({ title, administrator }: NavbarProps) {
  return (
    <header className="flex h-16 items-center justify-between bg-[#0F2747] px-6 text-white">
      <h1 className="text-lg font-semibold">{title}</h1>

      <div className="flex items-center gap-4">
        <NotificationBell />
        <div className="text-sm">{administrator}</div>
      </div>
    </header>
  );
}

export default Navbar;
