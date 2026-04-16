import { describe, expect, it } from "vitest";
import { createHistory, recordHistory, redo, undo } from "./history";

describe("history", () => {
  it("groups a recorded state into one undo and redo step", () => {
    const initial = { value: 1 };
    const next = { value: 2 };
    const history = recordHistory(createHistory(initial), next);

    expect(history.present).toBe(next);
    expect(history.past).toEqual([initial]);
    expect(history.future).toEqual([]);

    const undone = undo(history);
    expect(undone.present).toBe(initial);
    expect(undone.future).toEqual([next]);

    const redone = redo(undone);
    expect(redone.present).toBe(next);
  });

  it("does not record unchanged states", () => {
    const initial = { value: 1 };
    const history = recordHistory(createHistory(initial), initial);

    expect(history.past).toEqual([]);
    expect(history.future).toEqual([]);
    expect(history.present).toBe(initial);
  });
});
