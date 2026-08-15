// supabase/functions/delete-account/index.ts
// =============================================================================
// 🔐 Phase 1 (Lot 1.4) — SUPPRESSION DE COMPTE (exigence App Store / Google Play)
// =============================================================================
// Edge Function Supabase (Deno). L'utilisateur authentifié supprime SON compte :
//   1. authentification par le JWT de l'appelant (jamais par un id passé en corps),
//   2. effacement de ses données personnelles :
//        - flight_plans, validated_flight_pdfs (+ fichiers du bucket flight-plan-pdfs),
//        - votes et journaux de téléchargement,
//        - points VFR créés : ANONYMISÉS (uploaded_by → null) — ce sont des
//          données communautaires non personnelles (coordonnées géographiques),
//   3. suppression du compte auth lui-même (service role).
// Un admin ne peut PAS être supprimé par cette voie (garde-fou : retirer le
// rôle d'abord) — évite de se retrouver sans administrateur.
//
// Déploiement : voir instructions en bas de fichier.

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return json({ error: "Méthode non autorisée" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1. Identifier l'appelant depuis SON jeton (aucun paramètre de corps accepté)
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) {
      return json({ error: "Non authentifié" }, 401);
    }

    // Garde-fou : un compte admin doit d'abord perdre son rôle
    if ((user.app_metadata as Record<string, unknown>)?.role === "admin") {
      return json({
        error: "Un compte administrateur ne peut pas être supprimé par cette voie. Retirez d'abord le rôle admin (SQL) puis recommencez.",
      }, 403);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const uid = user.id;

    // 2a. Fichiers du bucket flight-plan-pdfs appartenant à l'utilisateur
    const { data: pdfRows } = await admin
      .from("validated_flight_pdfs")
      .select("pdf_storage_path")
      .eq("user_id", uid);
    const paths = (pdfRows ?? [])
      .map((r: { pdf_storage_path: string | null }) => r.pdf_storage_path)
      .filter((p: string | null): p is string => !!p);
    if (paths.length > 0) {
      await admin.storage.from("flight-plan-pdfs").remove(paths);
    }

    // 2b. Données personnelles en base (l'ordre respecte les FK éventuelles)
    await admin.from("validated_flight_pdfs").delete().eq("user_id", uid);
    await admin.from("flight_plans").delete().eq("user_id", uid);
    await admin.from("preset_votes").delete().eq("user_id", uid);
    await admin.from("preset_downloads").delete().eq("user_id", uid);
    // Points VFR : anonymisation (donnée communautaire, non personnelle)
    await admin.from("vfr_points").update({ uploaded_by: null }).eq("uploaded_by", uid);

    // 3. Suppression du compte auth
    const { error: deleteError } = await admin.auth.admin.deleteUser(uid);
    if (deleteError) {
      return json({ error: "Échec de suppression du compte: " + deleteError.message }, 500);
    }

    return json({ ok: true, message: "Compte et données personnelles supprimés." });
  } catch (e) {
    return json({ error: "Erreur interne: " + (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// =============================================================================
// DÉPLOIEMENT (deux options)
// -----------------------------------------------------------------------------
// Option A — Dashboard (sans CLI) :
//   Supabase → Edge Functions → Deploy a new function → nom : delete-account
//   → coller ce fichier → Deploy. (SUPABASE_URL / ANON_KEY / SERVICE_ROLE_KEY
//   sont injectées automatiquement.)
//
// Option B — CLI :
//   npx supabase login
//   npx supabase link --project-ref bgmscwckawgybymbimga
//   npx supabase functions deploy delete-account
// =============================================================================
