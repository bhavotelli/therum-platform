export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`font-logo font-bold tracking-tight lowercase ${className}`}>
      therum
    </span>
  );
}
