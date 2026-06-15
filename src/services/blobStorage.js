// src/services/blobStorage.js
//
// R20/B — Externalisation des GROS blobs base64 de aircraft_data vers Supabase
// Storage (motif MANEX). aircraft_data ne garde qu'une URL publique courte au
// lieu du base64 inline (PDF de pesée 4,6 Mo, images d'abaque 2,7 Mo) qui
// faisaient dépasser le statement_timeout Postgres à l'écriture.
//
// PRINCIPE DE SÛRETÉ : si un upload échoue, on CONSERVE le base64 inline (on ne
// perd JAMAIS la donnée — au pire la fiche reste grosse). Idempotent : un champ
// déjà sous forme d'URL (https) n'est pas re-uploadé.

import { supabase } from '../lib/supabaseClient';

const WEIGHING_BUCKET = 'weighing-reports';
const ABAQUE_BUCKET = 'abaque-images';

/** true si la valeur est une data URL base64 inline (à externaliser). */
export function isBase64DataUrl(s) {
  return typeof s === 'string' && s.startsWith('data:') && s.includes(';base64,');
}

/** Décode une data URL base64 → { blob, contentType }. */
function dataUrlToBlob(dataUrl) {
  const comma = dataUrl.indexOf(',');
  const meta = dataUrl.slice(5, comma); // ex. "application/pdf;base64"
  const contentType = meta.split(';')[0] || 'application/octet-stream';
  const b64 = dataUrl.slice(comma + 1);
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return { blob: new Blob([bytes], { type: contentType }), contentType };
}

/** Slug sûr pour un chemin Storage (immat, clés). */
function slug(s) {
  return String(s || 'x').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60) || 'x';
}

/** Upload une data URL → renvoie l'URL publique, ou null en cas d'échec. */
async function uploadDataUrl(bucket, path, dataUrl) {
  try {
    const { blob, contentType } = dataUrlToBlob(dataUrl);
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, blob, { cacheControl: '3600', upsert: true, contentType });
    if (error) {
      console.warn(`[blobStorage] upload ${bucket}/${path} échoué:`, error.message);
      return null;
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data?.publicUrl || null;
  } catch (e) {
    console.warn(`[blobStorage] upload ${bucket}/${path} exception:`, e?.message);
    return null;
  }
}

/**
 * Externalise les blobs base64 d'un aircraft_data vers Storage.
 * Renvoie un NOUVEL objet aircraft_data allégé (URLs au lieu de base64).
 * - weighingReport.pdfData (base64) → bucket weighing-reports, champ pdfUrl.
 * - performanceModels[].data.metadata.workshop.image.url (base64) → bucket
 *   abaque-images (l'URL publique remplace le base64 dans image.url ;
 *   le canevas <image href> fonctionne tel quel).
 * NON destructif : sur échec d'upload, le base64 est conservé.
 */
export async function externalizeAircraftBlobs(aircraftData, { registration } = {}) {
  if (!aircraftData || typeof aircraftData !== 'object') return aircraftData;
  const reg = slug(registration || aircraftData.registration || 'aircraft');
  let result = aircraftData;
  let mutated = false;
  const cloneOnce = () => { if (!mutated) { result = { ...aircraftData }; mutated = true; } };

  // 1) Fiche de pesée (le plus gros blob)
  const wr = aircraftData.weighingReport;
  if (wr && isBase64DataUrl(wr.pdfData)) {
    const url = await uploadDataUrl(WEIGHING_BUCKET, `${reg}/${reg} - pesee.pdf`, wr.pdfData);
    if (url) {
      cloneOnce();
      // On RETIRE le base64 (pdfData) et on garde une URL + les métadonnées.
      const { pdfData, ...wrRest } = wr;
      result.weighingReport = { ...wrRest, pdfUrl: url, hasData: true };
    }
  }

  // 2) Images d'abaque (workshop.image.url) par modèle
  const models = aircraftData.performanceModels;
  if (Array.isArray(models) && models.length) {
    const nextModels = [];
    let modelsMutated = false;
    for (let i = 0; i < models.length; i++) {
      const m = models[i];
      const img = m?.data?.metadata?.workshop?.image;
      if (img && isBase64DataUrl(img.url)) {
        const ext = (img.url.slice(5).split(';')[0].split('/')[1] || 'png').replace('jpeg', 'jpg');
        const url = await uploadDataUrl(ABAQUE_BUCKET, `${reg}/abaque-${slug(m.id || i)}.${ext}`, img.url);
        if (url) {
          modelsMutated = true;
          nextModels.push({
            ...m,
            data: {
              ...m.data,
              metadata: {
                ...m.data.metadata,
                workshop: {
                  ...m.data.metadata.workshop,
                  image: { ...img, url }
                }
              }
            }
          });
          continue;
        }
      }
      nextModels.push(m);
    }
    if (modelsMutated) { cloneOnce(); result.performanceModels = nextModels; }
  }

  return result;
}
