import './styles/theme.css';
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext"; // <-- make sure path is correct
import { SavvyPointsProvider } from "./store/savvyStore";

// import * as serviceWorkerRegistration from './serviceWorkerRegistration';
// serviceWorkerRegistration.unregister();


const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SavvyPointsProvider>
          <App />
        </SavvyPointsProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
















