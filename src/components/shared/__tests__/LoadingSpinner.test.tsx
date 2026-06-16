import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoadingSpinner } from "../LoadingSpinner";

describe("LoadingSpinner", () => {
  it("exposes an accessible loading status", () => {
    render(<LoadingSpinner />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("merges custom class names", () => {
    render(<LoadingSpinner className="h-10 w-10" />);
    const node = screen.getByRole("status");
    expect(node.className).toContain("h-10");
  });
});
