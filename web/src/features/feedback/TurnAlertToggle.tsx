import { useState } from "react";
import {
  alertsAvailable,
  alertsEnabled,
  muteAlerts,
  requestAlerts,
} from "../../state/turn-alerts";

// The opt-in for turn alerts, and nothing more.
//
// Permission is only ever requested from this click. Asking on load is
// what makes browsers bury the prompt and people refuse it reflexively,
// and a game that shouts before you have played one is not charming.
const TurnAlertToggle = () => {
  const [on, setOn] = useState(alertsEnabled);

  if (!alertsAvailable()) {
    // Unsupported, or already denied at the browser level - in which
    // case a button we cannot honour is worse than no button.
    return null;
  }

  // The separator belongs to the button rather than to the footer:
  // this component can decide not to render at all, and a footer that
  // punctuated around it would be left showing "daily · · privacy".
  return (
    <>
    {" · "}
    <button
      className="footer-link footer-button"
      title={
        on
          ? "you get a notification when it is your move in a background tab"
          : "get a notification when it is your move in a background tab"
      }
      onClick={async () => {
        if (on) {
          muteAlerts();
          setOn(false);
          return;
        }
        setOn(await requestAlerts());
      }}
    >
      {on ? "🔔 alerts on" : "🔕 alerts off"}
    </button>
    </>
  );
};

export default TurnAlertToggle;
