import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TopBar } from "../TopBar";

describe("TopBar", () => {
  it("shows the user email", () => {
    render(<TopBar email="dan@planna.com" />);
    expect(screen.getByText("dan@planna.com")).toBeInTheDocument();
  });

  it("posts to the sign-out route", () => {
    const { container } = render(<TopBar email="dan@planna.com" />);
    const form = container.querySelector("form");
    expect(form?.getAttribute("action")).toBe("/auth/signout");
    expect(form?.getAttribute("method")).toBe("post");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});
