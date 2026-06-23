import { redirect } from "next/navigation";
import { getUser, isSupabaseConfigured } from "@/lib/auth";
import ImportForm from "@/components/ImportForm";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  if (!isSupabaseConfigured()) redirect("/");
  const user = await getUser();
  if (!user) redirect("/login");
  return <ImportForm />;
}
