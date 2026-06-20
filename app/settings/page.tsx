import { redirect } from "next/navigation";
import { getUser, isSupabaseConfigured } from "@/lib/auth";
import { getSettings } from "@/app/actions/study";
import SettingsForm from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  if (!isSupabaseConfigured()) redirect("/");
  const user = await getUser();
  if (!user) redirect("/login");

  const settings = await getSettings();
  return <SettingsForm settings={settings} email={user.email ?? ""} />;
}
