const PRIORITY = Object.freeze({ error: 0, warn: 1, info: 2, debug: 3, silent: -1 });

export const createLogger = ({ level = "info", sink = console } = {}) => {
  const enabled = (name) => PRIORITY[level] >= PRIORITY[name];
  const write = (name, event, details = {}) => {
    if (!enabled(name)) return;
    const record = { timestamp: new Date().toISOString(), level: name, event, ...details };
    (sink[name] ?? sink.log)?.call(sink, record);
  };
  return Object.freeze({
    error: (event, details) => write("error", event, details),
    warn: (event, details) => write("warn", event, details),
    info: (event, details) => write("info", event, details),
    debug: (event, details) => write("debug", event, details),
  });
};

export const silentLogger = Object.freeze({
  error() {}, warn() {}, info() {}, debug() {},
});

