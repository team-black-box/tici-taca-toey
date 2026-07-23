import Brand from "./brand/Brand";
import Persona from "../player-persona/Player";

// The logo now lives inside Brand, so the whole lockup is one link home.
const Header = () => {
  return (
    <div className="header">
      <Brand />
      <Persona />
    </div>
  );
};

export default Header;
