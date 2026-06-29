import { redirect } from "next/navigation";
import { getUser, isSupabaseConfigured } from "@/lib/auth";
import TextImportForm from "@/components/TextImportForm";

export const dynamic = "force-dynamic";

export default async function TextImportPage() {
  if (!isSupabaseConfigured()) redirect("/");
  const user = await getUser();
  if (!user) redirect("/login");
  return <TextImportForm />;
}
