import { PlayerKind } from "./model";
import { AgentIcon, RobotIcon } from "./icons";

// One badge for what is sitting in a seat, so robots and MCP agents read
// the same everywhere they appear: rosters, lobby tiles, leaderboards.
// Humans get no icon - they are the default, and a badge on everyone is a
// badge on no one.
export const KindIcon = ({
  kind,
  className = "dim",
}: {
  kind: PlayerKind | undefined;
  className?: string;
}) => {
  if (kind === PlayerKind.ROBOT) {
    return <RobotIcon className={className} />;
  }
  if (kind === PlayerKind.AGENT) {
    return <AgentIcon className={className} />;
  }
  return null;
};

export const kindLabel = (kind: PlayerKind | undefined): string => {
  if (kind === PlayerKind.ROBOT) {
    return "robot";
  }
  if (kind === PlayerKind.AGENT) {
    return "ai agent (mcp)";
  }
  return "human";
};
