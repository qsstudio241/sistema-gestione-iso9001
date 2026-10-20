import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import WeldSketchPicker from "../components/WeldSketchPicker";

vi.mock("../services/apiService", () => ({
  default: {
    getWeldSketchBlob: vi.fn().mockResolvedValue(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" })),
    uploadWeldSketch: vi.fn(),
  },
}));

import apiService from "../services/apiService";

const SUG = {
  combined: [
    { id: 1, slot: "combined", score: 100, status: "bozza", source: "wpqr", dimension_text: "t=30 mm" },
    { id: 2, slot: "combined", score: 50, status: "confermato", source: "library" },
  ],
  joint_design: [],
  welding_sequence: [],
};

describe("WeldSketchPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiService.getWeldSketchBlob.mockResolvedValue(
      new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" })
    );
  });

  it("mostra lo schizzo WPQR prima e consente la scelta", async () => {
    const onChange = vi.fn();
    render(
      <WeldSketchPicker
        suggestions={SUG}
        selectedJointId={1}
        selectedSequenceId={null}
        onChange={onChange}
        companyId={51}
        jointType="FW"
      />
    );
    expect(screen.getByTestId("wsk-picker")).toBeInTheDocument();
    expect(screen.getByText(/Schizzo della WPQR/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("wsk-thumb-2"));
    expect(onChange).toHaveBeenCalledWith({
      joint_sketch_id: 2,
      sequence_sketch_id: 2,
      combined: true,
    });
    await waitFor(() => expect(apiService.getWeldSketchBlob).toHaveBeenCalled());
  });

  it("uno schizzo solo giunto non è combinato", () => {
    const onChange = vi.fn();
    render(
      <WeldSketchPicker
        suggestions={{
          combined: [],
          joint_design: [{ id: 9, slot: "joint_design", score: 80, status: "confermato", source: "library" }],
          welding_sequence: [],
        }}
        selectedJointId={null}
        selectedSequenceId={null}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByTestId("wsk-thumb-9"));
    expect(onChange).toHaveBeenCalledWith({
      joint_sketch_id: 9,
      sequence_sketch_id: null,
      combined: false,
    });
  });

  it("stato vuoto se non ci sono match", () => {
    render(
      <WeldSketchPicker
        suggestions={{}}
        selectedJointId={null}
        selectedSequenceId={null}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByTestId("wsk-empty")).toBeInTheDocument();
  });
});
