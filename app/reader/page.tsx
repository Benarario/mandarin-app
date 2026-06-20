import { redirect } from "next/navigation";
import { getUser, isSupabaseConfigured } from "@/lib/auth";
import { annotateMany } from "@/lib/annotate";
import { getMastery, getSettings } from "@/app/actions/study";
import { SEED_TEXTS, getSeedText } from "@/lib/seed/reader";
import ReaderView from "@/components/ReaderView";

export const dynamic = "force-dynamic";

export default async function ReaderPage({
  searchParams,
}: PageProps<"/reader">) {
  if (!isSupabaseConfigured()) redirect("/");
  const user = await getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const id = typeof params.id === "string" ? params.id : SEED_TEXTS[0].id;
  const text = getSeedText(id) ?? SEED_TEXTS[0];

  const [lines, mastery, settings] = await Promise.all([
    annotateMany(text.lines),
    getMastery(),
    getSettings(),
  ]);

  return (
    <ReaderView
      title={text.title}
      level={text.level}
      license={text.license}
      lines={lines}
      mastery={mastery}
      pinyinMode={settings.pinyin_mode}
    />
  );
}
