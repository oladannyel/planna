import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageHeader } from "../PageHeader";

describe("PageHeader", () => {
  it("renders the title as the page heading", () => {
    render(<PageHeader title="Board" />);
    expect(screen.getByRole("heading", { level: 1, name: "Board" })).toBeVisible();
  });

  it("renders breadcrumbs with a labelled nav", () => {
    render(
      <PageHeader
        title="Archive"
        crumbs={[{ label: "Board", href: "/board" }, { label: "Archive" }]}
      />,
    );
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Board" })).toHaveAttribute("href", "/board");
  });

  it("marks the final crumb as current and does not link it", () => {
    render(
      <PageHeader
        title="Archive"
        crumbs={[{ label: "Board", href: "/board" }, { label: "Archive" }]}
      />,
    );
    expect(screen.getByText("Archive", { selector: "span" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("renders an action slot", () => {
    render(<PageHeader title="Board" action={<button>New task</button>} />);
    expect(screen.getByRole("button", { name: "New task" })).toBeVisible();
  });

  it("omits the breadcrumb nav when there are no crumbs", () => {
    render(<PageHeader title="Board" />);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});
