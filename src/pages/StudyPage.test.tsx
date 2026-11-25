import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { routes } from "../app/router";
import { StudyProvider } from "../app/study";
import { cards } from "../content/content";
import { KEY } from "../progress/store";

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <StudyProvider>
      <RouterProvider router={router} />
    </StudyProvider>,
  );
  return userEvent.setup();
}

describe("review", () => {
  it("Portuguese first; reveal shows the English; an answer saves progress and moves on", async () => {
    const user = renderAt("/study");
    const first = cards[0]!;
    expect(await screen.findByText(first.pt)).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: first.en })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /show answer/i }));
    expect(screen.getByRole("group", { name: first.en })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^good/i }));
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    expect(Object.keys(saved.cards)).toEqual([first.id]);
    expect(await screen.findByText(cards[1]!.pt)).toBeInTheDocument();
  });

  it("works from the keyboard: Space reveals, 1-4 answer", async () => {
    const user = renderAt("/study");
    expect(await screen.findByText(cards[0]!.pt)).toBeInTheDocument();
    await user.keyboard(" ");
    expect(screen.getByRole("group", { name: cards[0]!.en })).toBeInTheDocument();
    await user.keyboard("1");
    expect(JSON.parse(localStorage.getItem(KEY) ?? "{}").log[0].rating).toBe(1);
  });

  it("the card on screen stays until answered, even when an earlier one comes due meanwhile", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = renderAt("/study");
      expect(await screen.findByText(cards[0]!.pt)).toBeInTheDocument();
      await user.keyboard(" ");
      await user.keyboard("1"); // Again: the first card comes back in about a minute
      expect(await screen.findByText(cards[1]!.pt)).toBeInTheDocument();
      await user.keyboard(" ");

      act(() => vi.advanceTimersByTime(3 * 60_000)); // the 30 s tick sees the first card due again
      expect(screen.getByText(cards[1]!.pt)).toBeInTheDocument();
      expect(screen.getByRole("group", { name: cards[1]!.en })).toBeInTheDocument();

      await user.keyboard("3"); // answered: now the card that came due is next
      expect(await screen.findByText(cards[0]!.pt)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("a lesson's study session uses only its cards", async () => {
    renderAt("/study?lesson=vocabulary-2");
    expect(await screen.findByText("Decidi arriscar e me candidatar à vaga.")).toBeInTheDocument();
    expect(screen.getByText(/9 new/)).toBeInTheDocument();
  });

  it("plays slowly (button or S) and says a tapped word alone, slowly", async () => {
    const spoken: { text: string; rate: number }[] = [];
    class Utterance {
      lang = "";
      rate = 1;
      constructor(public text: string) {}
    }
    vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
    vi.stubGlobal("speechSynthesis", {
      speak: (u: Utterance) => spoken.push({ text: u.text, rate: u.rate }),
      cancel: () => {},
    });
    try {
      const user = renderAt("/study");
      const first = cards[0]!;
      expect(await screen.findByText(first.pt)).toBeInTheDocument();
      await user.keyboard(" ");
      spoken.length = 0; // autoplay

      await user.click(screen.getByRole("button", { name: /^slow/i }));
      await user.keyboard("s");
      const word = first.en.match(/[A-Za-z']+/)![0];
      await user.click(screen.getByRole("button", { name: `Hear "${word}"` }));

      expect(spoken.map((s) => s.text)).toEqual([first.en, first.en, word]);
      for (const s of spoken) expect(s.rate).toBeLessThan(0.95);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
