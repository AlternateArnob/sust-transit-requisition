interface ButtonProps {
  children: React.ReactNode;
}

function Button({ children }: ButtonProps) {
  return (
    <button
      className="
        h-10
        rounded-md
        bg-[#0F2747]
        px-4
        font-medium
        text-white
        hover:bg-[#334E68]
        focus:outline-none
        focus:ring-2
        focus:ring-[#0F2747]
        focus:ring-offset-2
      "
    >
      {children}
    </button>
  );
}

export default Button;
