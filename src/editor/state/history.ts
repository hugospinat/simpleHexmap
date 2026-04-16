export type HistoryState<T> = {
  past: T[];
  present: T;
  future: T[];
};

export function createHistory<T>(initialState: T): HistoryState<T> {
  return {
    past: [],
    present: initialState,
    future: []
  };
}

export function recordHistory<T>(history: HistoryState<T>, nextState: T): HistoryState<T> {
  if (Object.is(history.present, nextState)) {
    return history;
  }

  return {
    past: [...history.past, history.present],
    present: nextState,
    future: []
  };
}

export function undo<T>(history: HistoryState<T>): HistoryState<T> {
  if (history.past.length === 0) {
    return history;
  }

  const previous = history.past[history.past.length - 1];

  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future]
  };
}

export function redo<T>(history: HistoryState<T>): HistoryState<T> {
  if (history.future.length === 0) {
    return history;
  }

  const next = history.future[0];

  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1)
  };
}
