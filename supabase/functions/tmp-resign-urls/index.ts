import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const TEN_YEARS = 315360000;

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const errors: string[] = [];
  let appointmentsUpdated = 0;
  let profilesUpdated = 0;

  const extractPath = (url: string, bucket: string): string | null => {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(url.slice(idx + marker.length).split("?")[0]);
  };

  const { data: appts, error: apptErr } = await supabase
    .from("appointments")
    .select("id, image_urls");
  if (apptErr) errors.push(`appointments select: ${apptErr.message}`);

  for (const row of appts ?? []) {
    const urls: string[] = row.image_urls ?? [];
    if (!urls.length) continue;
    let changed = false;
    const next: string[] = [];
    for (const url of urls) {
      const path = extractPath(url, "estudios_imagenes");
      if (!path) {
        next.push(url);
        continue;
      }
      const { data, error } = await supabase.storage
        .from("estudios_imagenes")
        .createSignedUrl(path, TEN_YEARS);
      if (error || !data?.signedUrl) {
        errors.push(`sign ${path}: ${error?.message ?? "sin URL"}`);
        next.push(url);
        continue;
      }
      next.push(data.signedUrl);
      changed = true;
    }
    if (!changed) continue;
    const { error: upErr } = await supabase
      .from("appointments")
      .update({ image_urls: next })
      .eq("id", row.id);
    if (upErr) errors.push(`appointment ${row.id}: ${upErr.message}`);
    else appointmentsUpdated++;
  }

  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, avatar_url");
  if (profErr) errors.push(`profiles select: ${profErr.message}`);

  for (const row of profiles ?? []) {
    if (!row.avatar_url) continue;
    const path = extractPath(row.avatar_url, "avatars");
    if (!path) continue;
    const { data, error } = await supabase.storage
      .from("avatars")
      .createSignedUrl(path, TEN_YEARS);
    if (error || !data?.signedUrl) {
      errors.push(`sign avatar ${path}: ${error?.message ?? "sin URL"}`);
      continue;
    }
    const { error: upErr } = await supabase
      .from("profiles")
      .update({ avatar_url: data.signedUrl })
      .eq("id", row.id);
    if (upErr) errors.push(`profile ${row.id}: ${upErr.message}`);
    else profilesUpdated++;
  }

  return new Response(
    JSON.stringify({ appointmentsUpdated, profilesUpdated, errors }),
    { headers: { "Content-Type": "application/json" } },
  );
});
