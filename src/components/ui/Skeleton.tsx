import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string;
  height?: string;
  rounded?: boolean;
}

function Skeleton({
  className,
  width,
  height,
  rounded = true,
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse bg-gray-200 dark:bg-gray-700",
        rounded && "rounded-md",
        className
      )}
      style={{
        ...(width ? { width } : {}),
        ...(height ? { height } : {}),
      }}
      {...props}
    />
  );
}

export { Skeleton };
