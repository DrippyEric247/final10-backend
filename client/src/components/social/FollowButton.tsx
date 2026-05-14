import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";
import "../../styles/SocialControls.css";

type FollowButtonProps = {
  /** User id of the target you'd be following. */
  targetUserId: string;
  /** Initial follow state, if you have it. Otherwise we trust optimistic toggle. */
  initiallyFollowing?: boolean;
  /** Disable the control entirely (e.g. on your own profile). */
  disabled?: boolean;
  /** Optional callback fired after a successful toggle. */
  onChange?: (isFollowing: boolean) => void;
  size?: "sm" | "md";
};

/**
 * Compact follow / unfollow toggle. Optimistic; rolls back on error.
 */
export default function FollowButton({
  targetUserId,
  initiallyFollowing = false,
  disabled = false,
  onChange,
  size = "md",
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initiallyFollowing);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsFollowing(initiallyFollowing);
  }, [initiallyFollowing]);

  if (disabled || !targetUserId) return null;

  const toggle = async () => {
    if (pending) return;
    setError(null);
    const next = !isFollowing;
    setIsFollowing(next);
    setPending(true);
    try {
      const { data } = await api.post(`/users/${targetUserId}/follow`);
      const serverState =
        typeof data?.isFollowing === "boolean" ? data.isFollowing : next;
      setIsFollowing(serverState);
      onChange?.(serverState);
    } catch (err) {
      setIsFollowing(!next);
      setError("Could not update follow state");
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      className={`follow-btn follow-btn--${size} ${
        isFollowing ? "is-following" : "is-not-following"
      }`}
      onClick={toggle}
      aria-pressed={isFollowing}
      aria-busy={pending}
      title={error || (isFollowing ? "Unfollow" : "Follow")}
    >
      {pending ? "…" : isFollowing ? "Following" : "Follow"}
    </button>
  );
}
