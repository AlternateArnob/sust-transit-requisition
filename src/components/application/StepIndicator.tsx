interface StepIndicatorProps {
  current: 1 | 2 | 3 | 4 | 5;
}

const STEPS: Array<{ id: 1 | 2 | 3 | 4 | 5; label: string }> = [
  { id: 1, label: "Requester" },
  { id: 2, label: "Transport User" },
  { id: 3, label: "Journey" },
  { id: 4, label: "Details" },
  { id: 5, label: "Recommendation" },
];

function pillClass(state: "done" | "current" | "pending") {
  if (state === "current") {
    return "bg-primary text-white border-primary";
  }
  if (state === "done") {
    return "bg-success-bg text-success border-success-bg";
  }
  return "bg-white text-text-muted border-border";
}

function connectorClass(state: "done" | "pending") {
  return state === "done" ? "bg-success" : "bg-border";
}

export default function StepIndicator({ current }: StepIndicatorProps) {
  return (
    <ol className="flex flex-wrap items-center gap-2">
      {STEPS.map((step, index) => {
        const state =
          step.id === current
            ? "current"
            : step.id < current
              ? "done"
              : "pending";
        const connectorState =
          step.id < current ? "done" : "pending";
        return (
          <li
            key={step.id}
            className="flex items-center gap-2"
            aria-current={state === "current" ? "step" : undefined}
          >
            <span
              className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full border px-2 text-xs font-semibold ${pillClass(state)}`}
            >
              {step.id}
            </span>
            <span
              className={`text-xs font-medium ${
                state === "current"
                  ? "text-primary"
                  : state === "done"
                    ? "text-success"
                    : "text-text-muted"
              }`}
            >
              {step.label}
            </span>
            {index < STEPS.length - 1 ? (
              <span
                aria-hidden="true"
                className={`mx-1 hidden h-px w-6 sm:inline-block ${connectorClass(connectorState)}`}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
