import React from "react";

const LABELS = {
  ahead: "Ahead",
  "close-chase": "Close Chase",
  "underdog-run": "Underdog Run",
  "neck-and-neck": "Neck and Neck",
};

const CLASS = {
  ahead: "f10-rival-badge f10-rival-badge--ahead",
  "close-chase": "f10-rival-badge f10-rival-badge--close",
  "underdog-run": "f10-rival-badge f10-rival-badge--underdog",
  "neck-and-neck": "f10-rival-badge f10-rival-badge--neck",
};

export function RivalryStatusBadge({ status }) {
  return (
    <span className={CLASS[status]} role="status">
      {LABELS[status]}
    </span>
  );
}
