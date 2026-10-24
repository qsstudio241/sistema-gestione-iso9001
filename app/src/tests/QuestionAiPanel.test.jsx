import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QuestionAiPanel from "../components/QuestionAiPanel";
import {
  AI_PANEL_HISTORY_KEY,
  resetQuestionAiHistoryForTests,
  SUGGEST_QUESTIONS_MODE,
} from "../utils/questionAiContext";

const mockPost = vi.fn();

vi.mock("../services/apiService", () => ({
  default: {
    post: (...args) => mockPost(...args),
  },
}));

const question = {
  id: "q-7",
  text: "Le risorse sono determinate?",
  clauseRef: "7.1.2",
  status: "C",
  notes: "Piano visto",
};

describe("QuestionAiPanel Fase 1", () => {
  beforeEach(() => {
    resetQuestionAiHistoryForTests();
    window.history.replaceState({}, "", window.location.href);
    mockPost.mockReset();
    mockPost.mockResolvedValue({
      success: true,
      data: {
        answer: "Chiedi chi decide le risorse e dove è scritto.",
        sourceDisclaimer: "Fonte di prova",
        hasOfficialSource: false,
        mode: SUGGEST_QUESTIONS_MODE,
      },
    });
  });

  it("senza licenza non mostra il pulsante", () => {
    const { container } = render(
      <QuestionAiPanel question={question} hasLicense={false} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("al tap chiama suggest_questions e mostra la risposta senza scrivere note", async () => {
    const user = userEvent.setup();
    const onNotesChange = vi.fn();
    render(
      <QuestionAiPanel
        question={question}
        standardCode="ISO_9001"
        hasLicense
        onNotesChange={onNotesChange}
      />
    );

    expect(screen.getAllByRole("button", { name: /Chiedi all'AI/i })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: /Chiedi all'AI/i }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    const [url, body] = mockPost.mock.calls[0];
    expect(url).toBe("/ai/question-assistant");
    expect(body.mode).toBe(SUGGEST_QUESTIONS_MODE);
    expect(body.question.clauseRef).toBe("7.1.2");
    expect(body.question.currentStatus).toBe("C");
    expect(body).not.toHaveProperty("attachments");
    expect(JSON.stringify(body)).not.toMatch(/vat|companyId|P\.IVA/i);

    expect(
      await screen.findByText(/Chiedi chi decide le risorse/i)
    ).toBeInTheDocument();
    expect(onNotesChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Applica a Note/i })).toBeNull();
  });

  it("Chiudi e Esc chiudono il pannello e restano sulla domanda", async () => {
    const user = userEvent.setup();
    render(<QuestionAiPanel question={question} hasLicense />);

    await user.click(screen.getByRole("button", { name: /Chiedi all'AI/i }));
    expect(await screen.findByText(/Come porre questa domanda/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Chiudi" }));
    await waitFor(() => {
      expect(screen.queryByText(/Come porre questa domanda/i)).toBeNull();
    });

    await user.click(screen.getByRole("button", { name: /Chiedi all'AI/i }));
    expect(await screen.findByRole("button", { name: "Chiudi" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Chiudi" })).toBeNull();
    });
  });

  it("mostra un messaggio chiaro se l'AI non è disponibile", async () => {
    mockPost.mockRejectedValueOnce({ code: "AI_NOT_CONFIGURED", status: 503 });
    const user = userEvent.setup();
    render(<QuestionAiPanel question={question} hasLicense />);
    await user.click(screen.getByRole("button", { name: /Chiedi all'AI/i }));
    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent(/non disponibile/i);
  });

  it("custom senza norma non manda standardCode al backend", async () => {
    const user = userEvent.setup();
    render(
      <QuestionAiPanel
        question={{ id: "c1", text: "Registro presente?", clauseRef: "A.1" }}
        standardCode={null}
        hasLicense
      />
    );
    await user.click(screen.getByRole("button", { name: /Chiedi all'AI/i }));
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    const body = mockPost.mock.calls[0][1];
    expect(body.question.standardCode).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("custom");
    expect(JSON.stringify(body)).not.toMatch(/ISO_9001/);
  });

  it("Indietro chiude il pannello e toglie la voce di history", async () => {
    const user = userEvent.setup();
    render(<QuestionAiPanel question={question} hasLicense />);
    await user.click(screen.getByRole("button", { name: /Chiedi all'AI/i }));
    expect(await screen.findByText(/Come porre questa domanda/i)).toBeInTheDocument();
    expect(window.history.state[AI_PANEL_HISTORY_KEY]).toBe("q-7");

    window.history.back();
    await waitFor(() => {
      expect(screen.queryByText(/Come porre questa domanda/i)).toBeNull();
    });
    expect(window.history.state?.[AI_PANEL_HISTORY_KEY]).toBeFalsy();
  });

  it("unmount con pannello aperto toglie la voce di history", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<QuestionAiPanel question={question} hasLicense />);
    await user.click(screen.getByRole("button", { name: /Chiedi all'AI/i }));
    expect(window.history.state[AI_PANEL_HISTORY_KEY]).toBe("q-7");
    unmount();
    await waitFor(() => {
      expect(window.history.state?.[AI_PANEL_HISTORY_KEY]).toBeFalsy();
    });
  });

  it("Chiudi e riapri prima del popstate lascia il nuovo pannello aperto", async () => {
    const user = userEvent.setup();
    const deferred = [];
    const nativeBack = window.history.back.bind(window.history);
    window.history.back = () => {
      deferred.push(nativeBack);
    };
    try {
      render(<QuestionAiPanel question={question} hasLicense />);
      await user.click(screen.getByRole("button", { name: /Chiedi all'AI/i }));
      expect(await screen.findByText(/Come porre questa domanda/i)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Chiudi" }));
      await user.click(screen.getByRole("button", { name: /Chiedi all'AI/i }));
      expect(screen.getByText(/Come porre questa domanda/i)).toBeInTheDocument();
      expect(deferred.length).toBeGreaterThan(0);
      while (deferred.length) deferred.shift()();
      await waitFor(() => {
        expect(screen.getByText(/Come porre questa domanda/i)).toBeInTheDocument();
      });
      expect(window.history.state[AI_PANEL_HISTORY_KEY]).toBe("q-7");
    } finally {
      window.history.back = nativeBack;
    }
  });
});

afterEach(() => {
  resetQuestionAiHistoryForTests();
});
