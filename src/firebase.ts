// firebase/config.ts
import { initializeApp } from 'firebase/app'
import { getStorage } from 'firebase/storage'

// Verify required environment variables
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN

console.log('🔍 Firebase Environment Variables Check:', {
  VITE_FIREBASE_API_KEY: apiKey ? `✅ ${apiKey.substring(0, 10)}...` : '❌ MISSING',
  VITE_FIREBASE_AUTH_DOMAIN: authDomain ? `✅ ${authDomain}` : '❌ MISSING',
})

if (!apiKey || !authDomain) {
  console.error('❌ CRITICAL: Firebase environment variables are missing!')
  console.error('Please ensure .env file contains:')
  console.error('- VITE_FIREBASE_API_KEY')
  console.error('- VITE_FIREBASE_AUTH_DOMAIN')
}

const firebaseConfig = {
  apiKey,
  authDomain,
  projectId: 'avoqado-d0a24',
  storageBucket: 'avoqado-d0a24.appspot.com',
  messagingSenderId: '219752736783',
  appId: '1:219752736783:web:e03d3b812775a14652db7a',
  measurementId: 'G-RHVHM6V578',
}

let app
let storage

try {
  app = initializeApp(firebaseConfig)
  console.log('✅ Firebase app initialized successfully')
  console.log('📦 App name:', app.name)
  console.log('📦 App options:', {
    projectId: app.options.projectId,
    storageBucket: app.options.storageBucket,
  })
} catch (error) {
  console.error('❌ Firebase app initialization failed:', error)
  if (error instanceof Error) {
    console.error('Error message:', error.message)
    console.error('Error name:', error.name)
  }
  storage = null
}

// Initialize storage with error handling
if (app) {
  try {
    storage = getStorage(app)
    console.log('✅ Firebase Storage initialized successfully')
    console.log('📦 Storage bucket:', storage.app.options.storageBucket)
  } catch (error) {
    console.warn('⚠️ Firebase Storage initialization failed. Storage features will be disabled.')
    console.error('Storage initialization error:', error)
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
      })
    }
    storage = null
  }
} else {
  console.warn('⚠️ Firebase app is undefined - skipping storage initialization')
  storage = null
}

export { storage }
