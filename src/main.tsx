import { render } from 'preact'
import './index.css'
import { App } from './app.tsx'
import './pwa'

render(<App />, document.getElementById('app')!)
