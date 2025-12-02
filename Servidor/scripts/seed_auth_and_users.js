// Seed Firebase Auth users (with passwords) and Firestore profiles
// Usage: node scripts/seed_auth_and_users.js <path-to-service-account.json> <path-to-seed-json> [DEFAULT_PASSWORD]
// Example: node scripts/seed_auth_and_users.js ./serviceAccountKey.json ./seed_users_firestore.json Veneris123!

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

async function main() {
  const saPath = process.argv[2];
  const seedPath = process.argv[3];
  const defaultPassword = process.argv[4] || 'Veneris123!';

  if (!saPath || !seedPath) {
    console.error('Usage: node scripts/seed_auth_and_users.js <serviceAccount.json> <seed.json> [DEFAULT_PASSWORD]');
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  const auth = admin.auth();
  const db = admin.firestore();

  const users = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  if (!Array.isArray(users)) {
    throw new Error('Seed JSON must be an array of user objects');
  }

  console.log(`Seeding ${users.length} users...`);

  let created = 0, updated = 0, failed = 0;

  for (const u of users) {
    const email = u.email;
    const displayName = u.userName;
    const photoURL = u.photoURL || '';
    const gender = u.gender || '';
    const age = u.age || null;
    const habits = u.habits || [];
    const preference = u.preference || 'ambos';
    const interests = u.interests || 'ambos';

    try {
      // Try to get existing user by email
      let userRecord;
      try {
        userRecord = await auth.getUserByEmail(email);
      } catch (e) {
        if (e.errorInfo && e.errorInfo.code === 'auth/user-not-found') {
          userRecord = null;
        } else {
          throw e;
        }
      }

      if (!userRecord) {
        // Create new auth user
        userRecord = await auth.createUser({
          email,
          password: defaultPassword,
          displayName,
          photoURL
        });
        created++;
        console.log(`Created auth user: ${email}`);
      } else {
        // Optionally update basic fields
        await auth.updateUser(userRecord.uid, { displayName, photoURL });
        updated++;
        console.log(`Updated auth user: ${email}`);
      }

      const uid = userRecord.uid;
      // Write Firestore profile (merge to avoid overwriting existing data)
      await db.collection('users').doc(uid).set({
        userId: uid,
        userName: displayName,
        email,
        photoURL,
        habits,
        preference,
        interests,
        gender,
        age,
        seededAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

    } catch (err) {
      failed++;
      console.error(`Failed for ${email}:`, err.message);
    }
  }

  console.log(`Done. Created: ${created}, Updated: ${updated}, Failed: ${failed}`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
