import './styles/theme.css';
import React from "react";
import ReactDOM from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { CosmeticsProvider } from "./context/CosmeticsContext";
import { SavvyPointsProvider } from "./store/savvyStore";
import AppErrorBoundary from "./components/AppErrorBoundary";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <HelmetProvider>
          <AuthProvider>
            <CosmeticsProvider>
              <SavvyPointsProvider>
                <App />
              </SavvyPointsProvider>
            </CosmeticsProvider>
          </AuthProvider>
        </HelmetProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>
);
