// frontend/src/store/store.js
// ─────────────────────────────────────────────────────────────
// Central Redux store.
// Add all slices here as you build each module.
// ─────────────────────────────────────────────────────────────
import {configureStore} from '@reduxjs/toolkit'
import authReducer from './slices/authSlice'
import studentsReducer from './slices/studentsSlice'
// Future slices imported here:
// import studentsReducer   from './slices/studentsSlice'
// import attendanceReducer from './slices/attendanceSlice'
// import feesReducer       from './slices/feesSlice'
// import notificationsReducer from './slices/notificationsSlice'

export const store =configureStore({
    reducer:{
        auth:authReducer,
         students:      studentsReducer,
        // attendance:    attendanceReducer,
        // fees:          feesReducer,
        // notifications: notificationsReducer,
    },

    middleware:(getDefaultMiddleware)=>
        getDefaultMiddleware(
            {
                serializableCheck:{
                    // Ignore these action types for non-serializable values (like FormData)
                    ignoredActions: ['auth/login/pending', 'auth/login/fulfilled'],
                },
            }),
             devTools: import.meta.env.DEV,  // Redux DevTools only in development
})

// TypeScript-style helpers (optional but useful)
export default store
