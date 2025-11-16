/**
 * Script de migración: normaliza los campos `email` (lowercase) y `celular` (digits-only)
 * Uso (desde carpeta `functions`):
 *   1. Instala dependencias: `npm install firebase-admin`
 *   2. Exporta variable de entorno con tu service account: `setx GOOGLE_APPLICATION_CREDENTIALS "C:\path\to\serviceAccountKey.json"` (Windows)
 *   3. Ejecuta: `node normalize_users.js`
 *
 * ADVERTENCIA: este script modifica documentos en Firestore. Haz backup antes.
 */

const admin = require('firebase-admin');

try {
  admin.initializeApp();
} catch (e) {}

const db = admin.firestore();

async function main() {
  const snapshot = await db.collection('usuarios').get();
  console.log('Docs encontrados:', snapshot.size);
  let updated = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const rawEmail = data.rawEmail || data.email || null;
    const rawPhone = data.rawPhone || data.celular || null;
    const normalizedEmail = rawEmail ? String(rawEmail).toLowerCase() : null;
    const normalizedPhone = rawPhone ? String(rawPhone).replace(/\D/g, '') : null;

    const toUpdate = {};
    if (normalizedEmail && data.email !== normalizedEmail) toUpdate.email = normalizedEmail;
    if (normalizedPhone && data.celular !== normalizedPhone) toUpdate.celular = normalizedPhone;
    if (!data.rawEmail && rawEmail) toUpdate.rawEmail = rawEmail;
    if (!data.rawPhone && rawPhone) toUpdate.rawPhone = rawPhone;

    if (Object.keys(toUpdate).length > 0) {
      await db.collection('usuarios').doc(doc.id).update(toUpdate);
      updated++;
      console.log('Actualizado', doc.id, toUpdate);
    }
  }
  console.log('Actualizaciones realizadas:', updated);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
