import { SmartCoachBanner } from "./SmartCoachBanner";
import { SmartCoachModal } from "./SmartCoachModal";
import { useSmartCoach } from "../../hooks/useSmartCoach";

export default function SmartCoachHost({ enabled }: { enabled: boolean }) {
  const { activeMessage, dismissActiveMessage, onMessageAction } = useSmartCoach(enabled);

  if (!enabled || !activeMessage) return null;

  if (activeMessage.presentation === "modal") {
    return (
      <SmartCoachModal
        message={activeMessage}
        onDismiss={dismissActiveMessage}
        onAction={onMessageAction}
      />
    );
  }

  return (
    <SmartCoachBanner
      message={activeMessage}
      onDismiss={dismissActiveMessage}
      onAction={onMessageAction}
    />
  );
}

