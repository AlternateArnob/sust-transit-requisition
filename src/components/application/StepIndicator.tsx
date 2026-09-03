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
    return "bg-[#0F2747] text-white border-[#0F2747]";
  }
  if (state === "done") {
    return "bg-[#DCFCE7] text-[#15803D] border-[#DCFCE7]";
  }
  return "bg-white text-[#64748B] border-[#E2E8F0]";
}

function connectorClass(state: "done" | "pending") {
  return state === "done" ? "bg-[#15803D]" : "bg-[#E2E8F0]";
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
                  ? "text-[#0F2747]"
                  : state === "done"
                    ? "text-[#15803D]"
                    : "text-[#64748B]"
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
