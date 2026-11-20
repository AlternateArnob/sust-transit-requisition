import PageTitle from "@/shared/ui/PageTitle";

export default function DashboardHeader({ subtitle }: { subtitle: string }) {
  return (
    <PageTitle
      title="Dashboard"
      subtitle={
        <>
          {subtitle} —{" "}
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </>
      }
    />
  );
}
