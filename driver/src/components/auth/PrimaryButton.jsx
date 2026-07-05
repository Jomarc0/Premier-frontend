export default function PrimaryButton({ children, disabled = false, onClick, icon }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 font-semibold text-white transition-colors ${
        disabled
          ? 'cursor-not-allowed bg-brand-primary/40'
          : 'bg-brand-primary hover:bg-brand-primary-dark'
      }`}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      {children}
    </button>
  );
}
