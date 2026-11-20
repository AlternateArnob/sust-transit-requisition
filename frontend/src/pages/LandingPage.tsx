import { Link } from "react-router-dom";

import SustLogo from "../components/SustLogo";
import LogoutButton from "../components/LogoutButton";
import { buttonClass } from "../components/ui/buttonStyles";
import useAuth from "../hooks/useAuth";
import { isAdminRole } from "../utils/permissions";

const STEPS = [
  {
    title: "Apply",
    text: "Submit a vehicle requisition with the journey details and purpose.",
  },
  {
    title: "Recommend",
    text: "Your Department or Office Head reviews and recommends the request.",
  },
  {
    title: "Approve",
    text: "The Transport Office allocates a vehicle and issues the slips.",
  },
];

/**
 * Public front page. Deliberately plain: logo, one paragraph, the two
 * entry points. Signed-in users get a shortcut to their own home instead
 * of the login button.
 */
export default function LandingPage() {
  const { currentUser, isAuthenticated } = useAuth();

  const isTransportStaff = isAdminRole(currentUser?.role);
  const homePath =
    isTransportStaff || currentUser?.role === "DepartmentHead"
      ? "/admin"
      : "/dashboard";

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="bg-primary text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <SustLogo heightClass="h-10" badge />
            <span className="text-base font-semibold sm:text-lg">
              SUST Transport Requisition
            </span>
          </div>
          {isAuthenticated ? <LogoutButton /> : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 sm:py-16">
        <section className="rounded-lg border border-form-rule bg-white px-6 py-10 text-center shadow-sm sm:px-12 sm:py-14">
          <SustLogo heightClass="h-20" className="mx-auto block" />
          <p className="mt-4 text-xs uppercase tracking-wide text-form-muted">
            Shahjalal University of Science and Technology · Transport Wing
          </p>
          <h1 className="mt-3 text-2xl font-bold text-form-action sm:text-3xl">
            Transport Requisition Management System
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-form-muted sm:text-base">
            Request university vehicles, follow the approval of your
            requisition and download your confirmation slip, all in one place.
            The system replaces paper forms for the faculty, officers and staff
            of the university.
          </p>

          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            {isAuthenticated ? (
              <Link to={homePath} className={`${buttonClass("primary")} justify-center`}>
                Go to my dashboard
              </Link>
            ) : (
              <Link to="/login" className={`${buttonClass("primary")} justify-center`}>
                Log in
              </Link>
            )}
            {!isTransportStaff ? (
              <Link to="/apply" className={`${buttonClass("secondary")} justify-center`}>
                Submit Transport Requisition
              </Link>
            ) : null}
          </div>

          {!isAuthenticated ? (
            <p className="mt-5 text-sm text-form-muted">
              New to the system?{" "}
              <Link to="/register" className="font-medium text-primary hover:underline">
                Create an account
              </Link>
              . You will be asked to log in before submitting a requisition.
            </p>
          ) : null}
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <div
              key={step.title}
              className="rounded-lg border border-form-rule bg-white p-5 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-form-muted">
                Step {index + 1}
              </p>
              <h2 className="mt-1 text-base font-semibold text-form-action">
                {step.title}
              </h2>
              <p className="mt-2 text-sm text-form-muted">{step.text}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-form-rule bg-white py-4 text-center text-xs text-form-muted">
        © Shahjalal University of Science and Technology, Sylhet
      </footer>
    </div>
  );
}
