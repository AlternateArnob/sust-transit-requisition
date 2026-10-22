interface WelcomeProps {
  name: string;
}

function Welcome({ name }: WelcomeProps) {
  return (
    <section className="rounded-lg border border-border bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-bold text-text">Welcome, {name}</h2>

      <p className="mt-2 text-text-muted">Transport Administration System</p>
    </section>
  );
}

export default Welcome;
