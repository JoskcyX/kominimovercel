import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DailyConnection } from "./DailyConnection";

const mock = vi.hoisted(() => ({ handlers: new Map<string, (event?: unknown) => void>(), state: "new", join: vi.fn(), destroy: vi.fn() }));
vi.mock("@daily-co/daily-js", () => ({ default: { createFrame: () => ({
  on: (event: string, handler: (event?: unknown) => void) => mock.handlers.set(event, handler),
  iframe: () => null,
  meetingState: () => mock.state,
  join: mock.join,
  leave: vi.fn(),
  destroy: mock.destroy,
}) } }));

afterEach(() => { cleanup(); vi.useRealTimers(); mock.handlers.clear(); mock.state = "new"; mock.join.mockClear(); });

describe("Daily meeting recovery", () => {
  it("rejoins after a network interruption without leaving the platform", async () => {
    const leave = vi.fn();
    render(<DailyConnection url="https://example.daily.co/class?t=test-token" audioOnly={false} onLeave={leave} />);
    await waitFor(() => expect(mock.join).toHaveBeenCalledOnce());
    act(() => { mock.state = "joined-meeting"; mock.handlers.get("joined-meeting")?.(); });
    act(() => { mock.handlers.get("network-connection")?.({ event: "interrupted", type: "sfu" }); mock.state = "left-meeting"; mock.handlers.get("left-meeting")?.(); });
    await waitFor(() => expect(mock.join).toHaveBeenCalledTimes(2));
    expect(leave).not.toHaveBeenCalled();
  });
  it("stops automatic recovery after exactly two minutes", async () => {
    const leave = vi.fn();
    render(<DailyConnection url="https://example.daily.co/class" audioOnly={false} onLeave={leave} />);
    await waitFor(() => expect(mock.join).toHaveBeenCalledOnce());
    vi.useFakeTimers();
    act(() => mock.handlers.get("network-connection")?.({ event: "interrupted", type: "sfu" }));
    act(() => vi.advanceTimersByTime(119999));
    expect(leave).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(leave).toHaveBeenCalledOnce();
  });
  it("honours an intentional leave instead of automatically rejoining", async () => {
    const leave = vi.fn();
    render(<DailyConnection url="https://example.daily.co/class" audioOnly={false} onLeave={leave} />);
    await waitFor(() => expect(mock.join).toHaveBeenCalledOnce());
    act(() => { mock.handlers.get("joined-meeting")?.(); mock.handlers.get("left-meeting")?.(); });
    expect(leave).toHaveBeenCalledOnce();
    expect(mock.join).toHaveBeenCalledOnce();
  });
});