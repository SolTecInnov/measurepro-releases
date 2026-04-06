/**
 * Script to create beta test accounts in Firebase
 * 
 * Usage: node server/create-beta-account.mjs
 * 
 * This creates the beta test account:
 * - Email: info@groupebellemare.com
 * - Password: oversize
 * - Restricted features as defined in src/lib/auth/masterAdmin.ts
 */

import admin from 'firebase-admin';

async function createBetaAccount() {
  try {
    // Firebase Admin SDK should already be initialized in server/index.ts
    // If running standalone, initialize here
    if (!admin.apps.length) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      });
    }

    const email = 'info@groupebellemare.com';
    const password = 'oversize';
    const displayName = 'Groupe Bellemare (Beta Tester)';

    console.log('🔧 Creating beta test account...');
    console.log('Email:', email);

    try {
      // Try to create the user
      const userRecord = await admin.auth().createUser({
        email,
        password,
        emailVerified: true,
        displayName,
      });

      console.log('✅ Beta test account created successfully!');
      console.log('UID:', userRecord.uid);
      console.log('Email:', userRecord.email);
      console.log('\n📋 Account Details:');
      console.log('- Email: info@groupebellemare.com');
      console.log('- Password: oversize');
      console.log('- Display Name:', displayName);
      console.log('\n🔒 Restricted Features:');
      console.log('- NO calibration');
      console.log('- NO AI detection');
      console.log('- NO Envelope Clearance');
      console.log('- NO Convoy Guardian');
      console.log('- NO Route Enforcement');
      console.log('- NO Swept Path Analysis');
      console.log('- NO Admin access');
      console.log('- NO 3D Point Cloud Scanning');
      console.log('- NO GNSS Profiling');
      console.log('- NO Measurement Configuration');
      console.log('- NO Measurement Controls');
      console.log('\n✅ Allowed Features:');
      console.log('- Manual POI logging');
      console.log('- Data logging (all POI types)');
      console.log('- Counter detection mode');
      console.log('- GPS tracking');
      console.log('- Photo capture');
      console.log('- Basic measurements');

    } catch (error) {
      if (error.code === 'auth/email-already-exists') {
        console.log('⚠️  Account already exists - updating password...');
        
        const existingUser = await admin.auth().getUserByEmail(email);
        await admin.auth().updateUser(existingUser.uid, {
          password,
          emailVerified: true,
          displayName,
        });
        
        console.log('✅ Password and details updated successfully!');
        console.log('UID:', existingUser.uid);
        console.log('Email:', existingUser.email);
      } else {
        throw error;
      }
    }

    console.log('\n🎉 Beta account is ready to use!');
    console.log('Users can now sign in at: /login');

  } catch (error) {
    console.error('❌ Error creating beta account:', error.message);
    console.error('\n💡 Manual Creation Steps:');
    console.log('1. Go to Firebase Console > Authentication');
    console.log('2. Click "Add User"');
    console.log('3. Email: info@groupebellemare.com');
    console.log('4. Password: oversize');
    console.log('5. The restrictions are automatically applied based on email');
    process.exit(1);
  }
}

// Run the script
createBetaAccount()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
