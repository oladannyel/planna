import { ThemeToggler } from "@/components/theme";
import { RequestForm } from "@/features/request";

export default function PublicRequestPage({ params }: { params: { slug: string } }) {
  return (
    <main className="relative flex min-h-dvh items-start justify-center bg-canvas px-4 py-12">
      <div className="absolute end-4 top-4">
        <ThemeToggler />
      </div>
      <div className="w-full max-w-lg">
        <RequestForm slug={params.slug} />
      </div>
    </main>
  );
}
