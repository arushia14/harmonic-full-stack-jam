// frontend/src/main.tsx

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { TaskProvider } from './contexts/TaskContext.tsx'
import { Toaster } from 'react-hot-toast'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Wrap the App with the TaskProvider */}
    <TaskProvider>
      <App />
      {/* Add the Toaster component here for notifications */}
      <Toaster position="bottom-right" />
    </TaskProvider>
  </React.StrictMode>,
)