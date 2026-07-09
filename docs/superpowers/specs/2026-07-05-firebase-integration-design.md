# Firebase Integration Design Specification

## Overview
This document outlines the design for migrating the Adaptive Workouts app's storage from local `localStorage` to Firebase Firestore. The goal is to allow users to log in across multiple devices and seamlessly sync their workout catalog, history, and settings, while retaining offline capabilities.

## 1. Authentication
- **Provider:** Google Sign-in via Firebase Auth.
- **Workflow:** 
  - Users are prompted to sign in when opening the app.
  - A new `auth.js` utility will encapsulate Firebase Auth initialization, login, logout, and an authentication state observer.
  - App state will reflect the current user's authentication status (e.g., displaying a login screen vs. the main app).

## 2. Offline Support
- **Local Persistence:** We will enable Firestore's local persistence.
- **Benefits:** Users can view their catalogs, start workouts, and log new entries offline. All local changes will be cached and automatically synced to the remote Firestore database when the device comes back online.

## 3. Data Architecture (Firestore)
We will use a subcollection-based architecture for strong data grouping and to simplify security rules.

- **Root Collection:** `users`
- **User Document:** `users/{userId}`
  - The document will store the user's settings (e.g., `warmupTime`, `staleThreshold`, `legDayOfWeek`).
- **Catalog Subcollection:** `users/{userId}/catalog/{exerciseId}`
  - **Template Model:** When a new user logs in for the first time, a copy of the default exercise catalog is generated and written to their subcollection.
  - Users can independently edit, add, or delete exercises in their catalog without affecting others.
- **History Subcollection:** `users/{userId}/history/{workoutId}`
  - Each completed workout session is stored as a document in this subcollection.

## 4. Code Changes & Integration
- **`src/utils/storage.js`:** 
  - Migrate functions (`getHistory`, `saveWorkout`, `getSettings`, `saveSettings`, `getCatalog`, `saveCatalog`) to use Firebase Firestore APIs (`doc`, `getDoc`, `setDoc`, `collection`, `addDoc`, `getDocs`).
  - **Data Migration:** Upon a user's first login, if there is existing data in `localStorage` (like their current customized catalog, settings, and history), we will automatically migrate it to their new Firestore account. If no local data exists, it will fall back to seeding the default catalog.
- **`src/utils/auth.js` (New):**
  - Encapsulate Firebase Authentication logic.
- **React Components:**
  - Introduce an `AuthContext` or state wrapper at the top level (e.g., in `App.jsx`) to manage and distribute the user's authentication state.
  - Update `Settings.jsx`, `Generator.jsx`, and `WorkoutView.jsx` to handle asynchronous data fetching and display loading states appropriately.

## 5. Security Rules
We will implement Firestore security rules to ensure users can only access and modify their own data:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      match /catalog/{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      
      match /history/{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

## 6. Local Development & Testing
- **Firebase Local Emulator Suite:** For local development and testing (especially within browser tools or offline workflows), we will configure the app to connect to the Firebase Local Emulator for Auth and Firestore when running in development mode (e.g., when `NODE_ENV === 'development'` or based on Vite environment variables). 
- **Benefits:** This prevents polluting production data during testing, enables easy mocking of auth states, and allows developers to inspect the mock database directly in the emulator UI.

## 7. Open Questions / Next Steps
- Firebase Project Setup: The user will need to provide the Firebase configuration object to initialize the app. This config will be placed in a `.env` file.
