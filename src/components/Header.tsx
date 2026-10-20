interface HeaderProps {
  title: string;
}

function Header({ title }: HeaderProps) {
  return (
    <header className="bg-[#0F2747] px-6 py-4 text-white">
      <h1 className="text-xl font-semibold">{title}</h1>
    </header>
  );
}

export default Header;
