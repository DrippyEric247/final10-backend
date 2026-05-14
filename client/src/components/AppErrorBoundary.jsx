import React from "react";
import { reportCrash } from "../lib/crashReporting";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    reportCrash({
      message: error?.message || "React render error",
      stack: error?.stack,
      name: error?.name,
      componentStack: info?.componentStack,
      extra: { boundary: "AppErrorBoundary" },
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[40vh] flex flex-col items-center justify-center px-6 py-16 text-center text-white bg-gray-950">
          <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
          <p className="text-gray-400 text-sm max-w-md mb-6">
            The error was reported automatically. Try refreshing the page.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
