const statusElement = document.querySelector("#connection-status");

const updateStatus = (label, state) => {
  if (!statusElement) {
    return;
  }

  statusElement.textContent = label;
  statusElement.dataset.state = state;
};

if (typeof window.io === "function") {
  const socket = window.io();

  socket.on("connect", () => {
    updateStatus("Connected", "connected");
  });

  socket.on("disconnect", () => {
    updateStatus("Disconnected", "disconnected");
  });

  socket.io.on("reconnect_attempt", () => {
    updateStatus("Reconnecting…", "reconnecting");
  });

  socket.on("connect_error", () => {
    updateStatus("Disconnected", "disconnected");
  });
} else {
  updateStatus("Disconnected", "disconnected");
}
