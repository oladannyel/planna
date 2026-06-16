import { RequestForm } from "@/features/request";

export default function PublicRequestPage({ params }: { params: { slug: string } }) {
  return (
    <main className="flex min-h-dvh items-start justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-lg">
        <RequestForm slug={params.slug} />
      </div>
    </main>
  );
}
