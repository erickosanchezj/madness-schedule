const fs = require('fs');  
const path = require('path');  
  
// Load environment variables  
require('dotenv').config();  
  
const config = {  
  apiKey: process.env.FIREBASE_API_KEY,  
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,  
  projectId: process.env.FIREBASE_PROJECT_ID,  
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,  
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,  
  appId: process.env.FIREBASE_APP_ID  
};  
  
// Validate all required config values are present  
const missing = Object.entries(config).filter(([key, value]) => !value).map(([key]) => key);  
if (missing.length > 0) {  
  console.error('Missing required environment variables:', missing);  
  process.exit(1);  
}  
  
// Generate config file for web app  
const webConfigJs = `window.firebaseConfig = ${JSON.stringify(config, null, 2)};`;  
fs.writeFileSync('public/firebase-config.js', webConfigJs);  
  
// Generate config file for service worker (can't access window)  
const swConfigJs = `const firebaseConfig = ${JSON.stringify(config, null, 2)};`;  
fs.writeFileSync('public/sw-firebase-config.js', swConfigJs);  
  
console.log('✅ Firebase configuration files generated successfully');