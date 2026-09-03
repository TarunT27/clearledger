import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './design/tokens.css'
import './design/base.css'
import './design/components.css'
import './design/shell.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
