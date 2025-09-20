import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import { ThemeProvider } from "./app/providers/ThemeContext";
import 'semantic-ui-css/semantic.min.css'
import { BrowserRouter } from 'react-router-dom';
import "./styles/globals.css";

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
<React.StrictMode>
     <BrowserRouter>
  <ThemeProvider>
    <App />
  </ThemeProvider>
     </BrowserRouter>
   </React.StrictMode>
);

