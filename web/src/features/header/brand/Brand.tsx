import { MouseEvent } from "react";
import { GithubIcon } from "../../../common/icons";
import Logo from "../../../common/logo";
import { navigate } from "../../../common/router";
import { setActiveGame } from "../../../state/actions";

// The logo and wordmark together are the way home. A real <a href="/">, so
// middle-click, cmd-click and "open in new tab" behave the way people
// expect; the handler intercepts plain left-clicks for client-side routing
// instead of a full page reload.
const Brand = () => {
  const goHome = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return; // let the browser open a new tab/window itself
    }
    event.preventDefault();
    // Clearing the active game is what actually returns the stage to the
    // welcome panel - the route alone does not, since <Game /> renders
    // whatever game is active. The game stays in "your games".
    setActiveGame("");
    navigate("/");
  };

  return (
    <h1 className="brand">
      <a className="brand-home" href="/" onClick={goHome}>
        <Logo className="logo" />
        <span>
          tici-taca-toey<span className="cursor">_</span>
        </span>
      </a>
      <a
        href="https://github.com/team-black-box/tici-taca-toey"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="GitHub"
      >
        <GithubIcon />
      </a>
    </h1>
  );
};

export default Brand;
