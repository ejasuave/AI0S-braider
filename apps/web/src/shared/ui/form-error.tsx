export function FormError({ message }: { message: string }) {
  return (
    <p
      className="rounded-md border border-error/30 bg-error/5 px-3 py-2 text-sm text-error"
      role="alert"
    >
      {message}
    </p>
  );
}
