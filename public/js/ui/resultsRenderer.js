export const createResultsRenderer = () => ({
  update(view) {
    const list = document.getElementById("results-list");
    list.replaceChildren(...(view.results ?? []).map((result) => {
      const item = document.createElement("li");
      const detail = `${result.role}${result.forfeited ? " · Forfeited" : ""}${result.isHost ? " · Host" : ""}`;
      item.innerHTML = `<span>${result.position}</span><strong></strong><em></em>`;
      item.querySelector("strong").textContent = result.name;
      item.querySelector("em").textContent = detail;
      return item;
    }));
    document.querySelector(".result-hero > p:last-child").textContent = "Rematches and card exchanges arrive in the next stage.";
  },
});
