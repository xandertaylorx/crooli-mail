// Browser-only demo scenes, used by the website (web/) to show real screens of the app.
// e.g. /?scene=continue&theme=dark&provider=codex&select=2
import { useStore } from "../store";
import { isTauri } from "./agent";

export type DemoAuto = null | "summary" | "draft";

export function applyDemoScene() {
  if (isTauri()) return;
  const q = new URLSearchParams(location.search);
  const theme = q.get("theme");
  if (theme === "dark" || theme === "light") document.documentElement.dataset.theme = theme;
  const s = useStore.getState();
  const provider = q.get("provider");
  if (provider === "claude" || provider === "codex") useStore.setState({ provider });
  const select = Number(q.get("select"));
  if (select) s.select(select);
  if (q.get("banner") === "off") useStore.setState({ bannerDismissed: true });
  else if (q.has("scene")) useStore.setState({ bannerDismissed: false });
  switch (q.get("scene")) {
    case "continue":
      s.setPanel("continue");
      break;
    case "compose":
      s.setPanel("compose");
      break;
    case "palette":
      s.setPaletteOpen(true);
      break;
    case "summary":
    case "draft":
      useStore.setState({ demoAuto: q.get("scene") as DemoAuto });
      break;
  }
}
