import { hydrateRoot } from "react-dom/client";
import { Landing } from "./Landing";
hydrateRoot(document.getElementById("root")!, <Landing stats={(window as any).__STATS__} />);
