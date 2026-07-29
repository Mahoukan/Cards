const VALID_SCREENS = new Set(["home", "create", "join", "lobby", "game", "results"]);

export const normaliseScreen = (value) => VALID_SCREENS.has(value) ? value : "home";

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
    document.title = `${next === "home" ? "" : `${next[0].toUpperCase()}${next.slice(1)} · `}President`;
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
