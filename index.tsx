
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App 
        onSave={(data) => console.log('Saved', data)} 
        fileName="Untitled"
        settings={{ aiProvider: 'gemini', aiBaseUrl: '', aiApiKey: '', aiModel: 'gemini-2.0-flash' }}
        onShowMessage={(msg) => alert(msg)}
    />
  </React.StrictMode>
);
