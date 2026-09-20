// components/ui/Loader.tsx
type LoaderSize = "sm" | "md" | "lg";

interface LoaderProps {
  size?: LoaderSize;
  label?: string;
}

const SIZE_CLASSES: Record<LoaderSize, string> = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-10 w-10 border-[3px]",
};

export function Loader({ size = "md", label = "Loading" }: LoaderProps) {
  return (
    <div role="status" className="inline-flex items-center gap-2">
      <span
        className={[
          "animate-spin rounded-full border-primary border-t-transparent",
          SIZE_CLASSES[size],
        ].join(" ")}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}