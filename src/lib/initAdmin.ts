import { createUser, signInWithEmail } from './firebase';
import { toast } from 'sonner';

export const initializeAdmin = async () => {
  const adminEmail = 'jfprince@soltec.ca';
  const adminPassword = 'R00tPa$$';

  // Check if Firebase is configured
  const firebaseApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  if (!firebaseApiKey || firebaseApiKey === 'undefined') {
    toast.info('Running in offline-only mode (no cloud sync)');
    return true; // App works without Firebase
  }

  try {
    // Try to create the admin user
    await createUser(adminEmail, adminPassword);
    toast.success('Admin user created successfully');
    return true;
  } catch (error: any) {
    // If user already exists, just sign them in
    if (error.code === 'auth/email-already-in-use') {
      try {
        await signInWithEmail(adminEmail, adminPassword);
        toast.info('Admin user already exists - signed in');
        return true;
      } catch (signInError) {
        toast.error('Failed to sign in admin user');
        return false;
      }
    } else if (error.code === 'auth/api-key-not-valid.-please-pass-a-valid-api-key.') {
      // Firebase API key is invalid - run in offline mode
      toast.info('Running in offline-only mode (no cloud sync)');
      return true; // App works without Firebase
    } else {
      toast.error('Failed to create admin user: ' + error.message);
      return false;
    }
  }
};
