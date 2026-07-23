import Brand from "./brand/Brand";
import Persona from "../player-persona/Player";
import Logo from "../../common/logo";

const Header = () => {
  return (
    <div className="header">
      <Logo className="logo" />
      <Brand />
      <Persona />
    </div>
  );
};

export default Header;
