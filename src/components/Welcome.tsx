interface WelcomeProps {
  name: string;
}

function Welcome({ name }: WelcomeProps) {
  return (
    <section className="rounded-lg border border-[#E2E8F0] bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-bold text-[#1E293B]">Welcome, {name}</h2>

      <p className="mt-2 text-[#64748B]">Transport Administration System</p>
    </section>
  );
}

export default Welcome;
