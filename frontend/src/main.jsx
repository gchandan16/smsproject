import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query' 

// ── AdminLTE + Bootstrap ──────────────────────────────────
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'

import 'bootstrap-icons/font/bootstrap-icons.css'

import 'admin-lte/dist/css/adminlte.min.css'
//import 'admin-lte/dist/js/adminlte.min.js'

import {store} from './store/store'

import App from './App.jsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Redux store wraps everything */}
    <Provider store={store}>
      {/* TanStack Query for server-state (API calls) */}
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </Provider>
  </StrictMode>,
)

