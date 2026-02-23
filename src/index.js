import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import { i18nService } from './services/i18nService';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();
 
serviceWorkerRegistration.register({
  onUpdate: (registration) => {
    const choice = window.confirm(
      i18nService.t('serviceWorker.updateAvailable') + '\n\n' +
      i18nService.t('serviceWorker.cancelMessage')
    );
    
    if (choice) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    } else {
      console.log(i18nService.t('serviceWorker.updatePostponed'));
    }
  }
});