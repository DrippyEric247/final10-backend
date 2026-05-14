import React from "react";
import { Navigate } from "react-router-dom";

/** Legacy `/create-auction` — forwards to the live Promote lane (Trending). */
export default function CreateAuction() {
  return <Navigate to="/trending" replace />;
}
