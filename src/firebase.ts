// firebase/config.ts
import { initializeApp } from 'firebase/app'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: 'avoqado-d0a24',
  storageBucket: 'avoqado-d0a24.appspot.com',
  messagingSenderId: '219752736783',
  appId: '1:219752736783:web:e03d3b812775a14652db7a',
  measurementId: 'G-RHVHM6V578',
}

const app = initializeApp(firebaseConfig)
export const storage = getStorage(app)
