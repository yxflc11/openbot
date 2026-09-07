import icon from "../../../desktop/resources/openbot-icon.png";

/** One brand source shared with the native application bundle. */
export function OpenBotMark({ className = "" }: { className?: string }) {
  return <img className={`openbot-mark ${className}`} src={icon} alt="" aria-hidden="true" />;
}
