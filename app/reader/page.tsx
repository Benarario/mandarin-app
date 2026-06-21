import { redirect } from "next/navigation";
import { getUser, isSupabaseConfigured } from "@/lib/auth";
import { requireUser } from "@/lib/require-user";
import { annotateMany } from "@/lib/annotate";
import { getStatusMaps } from "@/lib/graph/mastery";
import { SEED_TEXTS, getSeedText } from "@/lib/seed/reader";
import ReaderView from "@/components/ReaderView";

export const dynamic = "force-dynamic";

export default async function ReaderPage({ searchParams }: PageProps<"/reader">) {
  if (!isSupabaseConfigured()) redirect("/");
  const user = await getUser();
  if (!user) redirect("/login");
  const { supabase } = await requireUser();

  const params = await searchParams;
  const id = typeof params.id === "string" ? params.id : SEED_TEXTS[0].id;
  const text = getSeedText(id) ?? SEED_TEXTS[0];

  const [lines, status, settingsRow] = await Promise.all([
    annotateMany(text.lines.map((l) => l.zh)),
    getStatusMaps(supabase, user.id),
    supabase.from("user_settings").select("pinyin_mode").eq("user_id", user.id).maybeSingle(),
  ]);

  return (
    <ReaderView
      title={text.title}
      level={text.level}
      license={text.license}
      lines={lines}
      english={text.lines.map((l) => l.en)}
      charStatus={status.char}
      wordStatus={status.word}
      pinyinMode={settingsRow.data?.pinyin_mode ?? "adaptive"}
    />
  );
}
