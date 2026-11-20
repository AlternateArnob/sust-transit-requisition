interface ModalProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}

export default function Modal({
  title,
  children,
  onClose,
  wide = false,
}: ModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className={`max-h-[90vh] w-full ${
          wide ? "max-w-3xl" : "max-w-lg"
        } overflow-y-auto rounded-lg border border-border bg-white shadow-lg`}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-white px-5 py-4">
          <h2 className="text-lg font-semibold text-text">{title}</h2>

          <button
            type="button"
            onClick={onClose}
            className="text-xl leading-none text-text-muted hover:text-text"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
