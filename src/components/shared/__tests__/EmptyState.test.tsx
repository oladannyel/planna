import { render, screen } from "@testing-library/react";
import { Rocket } from "lucide-react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "../EmptyState";

describe("EmptyState", () => {
  it("renders the title", () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("renders the optional message and action", () => {
    render(
      <EmptyState
        icon={Rocket}
        title="Empty"
        message="Add your first task"
        action={<button type="button">Add</button>}
      />,
    );
    expect(screen.getByText("Add your first task")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });

  it("omits message and action when not provided", () => {
    render(<EmptyState title="Bare" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
