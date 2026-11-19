import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CategoryBreakdown } from "../CategoryBreakdown";

describe("CategoryBreakdown", () => {
  it("lists every tag with its count", () => {
    render(
      <CategoryBreakdown
        data={[
          { tag: "infra", count: 4 },
          { tag: "docs", count: 1 },
        ]}
      />,
    );

    expect(screen.getByText("infra")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("docs")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("scales the bars against the largest count, not against the total", () => {
    const { container } = render(
      <CategoryBreakdown
        data={[
          { tag: "infra", count: 4 },
          { tag: "docs", count: 1 },
        ]}
      />,
    );

    const bars = container.querySelectorAll<HTMLElement>("li div > div");
    expect(bars[0]?.style.width).toBe("100%");
    expect(bars[1]?.style.width).toBe("25%");
  });

  it("says so when nothing is tagged", () => {
    render(<CategoryBreakdown data={[]} />);
    expect(screen.getByText("No tagged tasks yet.")).toBeInTheDocument();
  });
});
