import { redirect } from "next/navigation";
import { getUser, isSupabaseConfigured } from "@/lib/auth";
import { getMasteredItems } from "@/app/actions/progress";
import MasteredView from "@/components/MasteredView";

export const dynamic = "force-dynamic";

export default async function MasteredPage() {
  if (!isSupabaseConfigured()) redirect("/");
  const user = await getUser();
  if (!user) redirect("/login");

  const { characters, words } = await getMasteredItems();
  return <MasteredView characters={characters} words={words} />;
}
