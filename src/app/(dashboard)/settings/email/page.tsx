import { PageHeader } from "@/components/layout";
import {
  EmailConnectionCard,
  connectErrorMessage,
  getEmailConnection,
} from "@/features/email-intake";

export const metadata = { title: "Email intake · plAnna" };

export default async function EmailSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string }>;
}) {
  const [{ error }, connection] = await Promise.all([searchParams, getEmailConnection()]);

  const notice = connectErrorMessage(error);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Email intake"
        crumbs={[{ label: "Home", href: "/" }, { label: "Settings" }, { label: "Email" }]}
      />
      <EmailConnectionCard connection={connection.ok ? connection.value : null} notice={notice} />
    </div>
  );
}
