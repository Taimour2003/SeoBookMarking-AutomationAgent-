export function createUAPState(initialState = {}) {
  let state = { ...initialState };
  const listeners = new Set();

  function set(partial) {
    state = { ...state, ...partial };
    for (const fn of listeners) fn(state);
  }

  function get() {
    return state;
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  return { get, set, subscribe };
}

