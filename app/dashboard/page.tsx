import { redirect } from "next/navigation";
import { getUser, isSupabaseConfigured } from "@/lib/auth";
import { getSkills } from "@/app/actions/study";
import SkillDashboard from "@/components/SkillDashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) redirect("/");
  const user = await getUser();
  if (!user) redirect("/login");

  const skills = await getSkills();
  return <SkillDashboard skills={skills} />;
}
