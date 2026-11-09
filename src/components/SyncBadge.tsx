import { Link } from "react-router";
import { useStudy } from "../app/studyContext";

/** Where progress lives: this browser only (a link to the sign-in), synced, or waiting to be sent. */
export function SyncBadge() {
  const { sync } = useStudy();
  switch (sync.kind) {
    case "checking":
      return null;
    case "signed-out":
      return (
        <Link
          className="sync sync--out"
          to={{ pathname: "/", hash: "#sync" }}
          title="Progress is kept in this browser only"
        >
          Sign in to sync
        </Link>
      );
    case "synced":
      return (
        <span className="sync sync--ok" title={`Synced as ${sync.user}`} role="status">
          Synced
        </span>
      );
    case "pending":
      return (
        <span
          className="sync sync--pending"
          title={`${sync.count} waiting to be sent (offline?)`}
          role="status"
        >
          {sync.count} pending
        </span>
      );
  }
}
