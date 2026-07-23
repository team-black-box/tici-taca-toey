// The terminal status feed: every server error and connection event gets a
// line. Silence is a sharp edge; this file removes it.
import { ErrorCodes } from "../common/model";
import { AppState } from "./store";

export type FeedbackKind = "ok" | "info" | "warn" | "err";

export interface FeedbackEvent {
  id: number;
  kind: FeedbackKind;
  text: string;
  at: number;
}

// Friendly terminal-voice copy for every error the server can send.
// Unknown codes fall back to the raw code - never silence.
export { ERROR_COPY } from "../../../shared/copy";

let nextId = 1;
const MAX_EVENTS = 4;

const initialState: FeedbackEvent[] = [];

export interface FeedbackAction {
  type: "FEEDBACK";
  kind: FeedbackKind;
  text: string;
}

export const feedbackEvent = (
  kind: FeedbackKind,
  text: string
): FeedbackAction => ({ type: "FEEDBACK", kind, text });

const reducer = (
  state: FeedbackEvent[] = initialState,
  action: { type: string; kind?: FeedbackKind; text?: string }
): FeedbackEvent[] => {
  if (action.type === "FEEDBACK" && action.text) {
    return [
      ...state.slice(-(MAX_EVENTS - 1)),
      {
        id: nextId++,
        kind: action.kind ?? "info",
        text: action.text,
        at: Date.now(),
      },
    ];
  }
  if (action.type === "FEEDBACK_EXPIRE") {
    const cutoff = Date.now() - 6000;
    const alive = state.filter((event) => event.at > cutoff);
    return alive.length === state.length ? state : alive;
  }
  return state;
};

export default reducer;

export const getFeedback = (state: AppState) => state.feedback;
