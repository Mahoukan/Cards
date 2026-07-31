const SCREEN_ALIASES = new Map([["create", "start-game"], ["join", "join-game"]]);
const VALID_SCREENS = new Set(["home", "start-game", "join-game", "rules", "lobby", "game", "exchange", "results", "crazy-eights-game", "crazy-eights-results"]);

export const normaliseScreen = (value) => {
  const resolved = SCREEN_ALIASES.get(value) ?? value;
  return VALID_SCREENS.has(resolved) ? resolved : "home";
};

export const createScreenManager = ({ onChange = () => {} } = {}) => {
  const screens = [...document.querySelectorAll("[data-screen]")];
  let current = null;

  const show = (requested, { updateHistory = true } = {}) => {
    const next = normaliseScreen(requested);
    screens.forEach((screen) => {
      const active = screen.dataset.screen === next;
      screen.hidden = !active;
      screen.toggleAttribute("inert", !active);
    });
    current = next;
    document.body.dataset.screen = next;
    const generalTitle = { "start-game": "Start Game", "join-game": "Join Game", rules: "How to Play" }[next];
    const gameName = next.startsWith("crazy-eights") ? "Crazy Eights" : "President";
    document.title = next === "home" ? "Card Table" : `${generalTitle ?? gameName} · Card Table`;
    if (updateHistory) {
      const url = new URL(window.location.href);
      url.searchParams.set("screen", next);
      window.history.pushState({ screen: next }, "", url);
    }
    onChange(next);
    screens.find((screen) => screen.dataset.screen === next)?.querySelector("h1, h2, input, button")?.focus({ preventScroll: true });
    return next;
  };

  return { show, get current() { return current; } };
};
