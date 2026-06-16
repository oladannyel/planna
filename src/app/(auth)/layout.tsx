export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
