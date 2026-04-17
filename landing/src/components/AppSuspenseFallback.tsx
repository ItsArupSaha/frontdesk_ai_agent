import { LoadingSpinner } from "./LoadingSpinner";

export function AppSuspenseFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#06050a]">
      <LoadingSpinner size="lg" />
    </div>
  );
}
