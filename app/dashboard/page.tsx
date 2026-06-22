import { redirect } from "next/navigation";
import { getUser, isSupabaseConfigured } from "@/lib/auth";
import { getSkillStats } from "@/app/actions/progress";
import SkillDashboard from "@/components/SkillDashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) redirect("/");
  const user = await getUser();
  if (!user) redirect("/login");

  const { stats, chars, words, reviews } = await getSkillStats();
  return <SkillDashboard stats={stats} chars={chars} words={words} reviews={reviews} />;
}
