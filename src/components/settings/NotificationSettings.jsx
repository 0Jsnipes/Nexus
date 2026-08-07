import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useAuthStore } from "../../lib/authStore";
import { isPushSupported, getPushSubscriptionState, subscribeToPush, unsubscribeFromPush } from "../../lib/push";

const NotificationSettings = () => {
  const profile = useAuthStore((s) => s.profile);
  const [state, setState] = useState("checking"); // checking | unsupported | denied | unsubscribed | subscribed
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) {
      setState("unsupported");
      return;
    }
    getPushSubscriptionState().then(setState);
  }, []);

  const enable = async () => {
    setLoading(true);
    try {
      await subscribeToPush(profile.id);
      setState("subscribed");
      toast.success("Push notifications are on for this device.");
    } catch (err) {
      toast.error(err.message);
      setState(Notification.permission === "denied" ? "denied" : "unsubscribed");
    } finally {
      setLoading(false);
    }
  };

  const disable = async () => {
    setLoading(true);
    try {
      await unsubscribeFromPush();
      setState("unsubscribed");
      toast.success("Push notifications are off for this device.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <p className="nx-hint" style={{ marginBottom: 12 }}>
        Get notified on this device for new messages and mentions, even when Nexus isn&apos;t open.
      </p>

      {state === "checking" && <p className="nx-muted">Checking this device...</p>}

      {state === "unsupported" && (
        <p className="nx-muted">
          Push notifications aren&apos;t available in this browser. Installing Nexus as an app usually enables it.
        </p>
      )}

      {state === "denied" && (
        <p className="nx-muted">
          Notifications are blocked for Nexus in your browser settings. Allow them there to turn this on.
        </p>
      )}

      {(state === "unsubscribed" || state === "subscribed") && (
        <div className="nx-row" style={{ gap: 10 }}>
          <button
            type="button"
            className={`nx-switch ${state === "subscribed" ? "is-on" : ""}`}
            disabled={loading}
            onClick={() => (state === "subscribed" ? disable() : enable())}
            aria-label="Toggle push notifications"
          />
          <span className="nx-muted" style={{ fontSize: 13 }}>
            Push notifications are {state === "subscribed" ? "on" : "off"} for this device.
          </span>
        </div>
      )}
    </div>
  );
};

export default NotificationSettings;
