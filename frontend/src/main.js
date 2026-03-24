import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

createApp(App).mount('#app')

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('/sw-notify.js')
    } catch (error) {
      console.warn('Notification service worker registration failed', error)
    }
  })
}
