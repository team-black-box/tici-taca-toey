import { useAppSelector } from "../../state/store";
import { getFeedback } from "../../state/feedback";

const PREFIX = { ok: "✓", info: "~", warn: "!", err: "✗" } as const;

// The terminal status feed, floating above the footer.
const StatusLine = () => {
  const events = useAppSelector(getFeedback);
  if (events.length === 0) {
    return null;
  }
  return (
    <div className="status-feed" role="status" aria-live="polite">
      {events.map((event) => (
        <div key={event.id} className={`status-msg status-msg--${event.kind}`}>
          {PREFIX[event.kind]} {event.text}
        </div>
      ))}
    </div>
  );
};

export default StatusLine;
