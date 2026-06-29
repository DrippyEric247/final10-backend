import React from "react";
import { Link } from "react-router-dom";
import { MapPinOff } from "lucide-react";
import EmptyState from "../components/ui/states/EmptyState";

export default function NotFound() {
  return (
    <div className="py-8">
      <EmptyState
        className="f10-state--page max-w-lg mx-auto"
        icon={<MapPinOff className="h-6 w-6" />}
        title="Page not found"
        description="This route doesn't exist or may have moved. Head back home or reach out if you need help."
        action={
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Link to="/" className="btn btn-primary">
              Back to Home
            </Link>
            <Link to="/support" className="btn btn-ghost">
              Support
            </Link>
          </div>
        }
      />
    </div>
  );
}
