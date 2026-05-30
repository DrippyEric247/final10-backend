import React from "react";
import { reportCrash } from "../lib/crashReporting";
import { isBackendApiConfigured } from "../lib/runtimeApi";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
    this.handleReload = this.handleReload.bind(this);
    this.handleRetry = this.handleRetry.bind(this);
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || "Unexpected application error",
    };
  }

  componentDidCatch(error, info) {
    reportCrash({
      message: error?.message || "React render error",
      stack: error?.stack,
      name: error?.name,
      componentStack: info?.componentStack,
      extra: { boundary: "AppErrorBoundary" },
    }, { force: true });
  }

  handleReload() {
    window.location.reload();
  }

  handleRetry() {
    this.setState({ hasError: false, errorMessage: "" });
  }

  render() {
    if (this.state.hasError) {
      const apiMissing = !isBackendApiConfigured();

      return (
        <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16 text-center text-white bg-gray-950">
          <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
          <p className="text-gray-400 text-sm max-w-md mb-4">
            Final10 hit an unexpected error. You can try again or reload the page.
          </p>
          {this.state.errorMessage ? (
            <p className="text-gray-500 text-xs max-w-lg mb-4 break-words">
              {this.state.errorMessage}
            </p>
          ) : null}
          {apiMissing ? (
            <p className="text-amber-200/90 text-xs max-w-lg mb-6">
              Backend API URL is not configured for this deployment. Set{" "}
              <code className="text-amber-100">REACT_APP_API_URL</code> to your server origin and redeploy.
            </p>
          ) : (
            <p className="text-gray-500 text-xs max-w-md mb-6">
              The error was reported automatically when crash reporting is enabled.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button type="button" className="btn btn-primary" onClick={this.handleReload}>
              Reload page
            </button>
            <button type="button" className="btn btn-ghost" onClick={this.handleRetry}>
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
