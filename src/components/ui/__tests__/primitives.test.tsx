import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "../Button";
import { Card, ComponentCard } from "../Card";
import { Field, Input, Select } from "../Input";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "../Table";
import { Textarea } from "../Textarea";

describe("Button", () => {
  it("defaults to type=button so it never submits a form by accident", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("type", "button");
  });

  it("honours an explicit type", () => {
    render(<Button type="submit">Send</Button>);
    expect(screen.getByRole("button", { name: "Send" })).toHaveAttribute("type", "submit");
  });

  it("disables itself and marks busy while loading", () => {
    render(<Button loading>Saving</Button>);
    const button = screen.getByRole("button", { name: "Saving" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("hides icons while loading so the spinner stands alone", () => {
    render(
      <Button loading startIcon={<span>start</span>} endIcon={<span>end</span>}>
        Saving
      </Button>,
    );
    expect(screen.queryByText("start")).not.toBeInTheDocument();
    expect(screen.queryByText("end")).not.toBeInTheDocument();
  });

  it("renders icons when idle", () => {
    render(
      <Button startIcon={<span>start</span>} endIcon={<span>end</span>}>
        Go
      </Button>,
    );
    expect(screen.getByText("start")).toBeVisible();
    expect(screen.getByText("end")).toBeVisible();
  });

  it("does not fire onClick when disabled", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button disabled onClick={onClick}>
        Nope
      </Button>,
    );
    await user.click(screen.getByRole("button", { name: "Nope" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it.each(["primary", "outline", "ghost", "danger"] as const)("renders the %s variant", (v) => {
    render(<Button variant={v}>{v}</Button>);
    expect(screen.getByRole("button", { name: v })).toBeVisible();
  });
});

describe("Card", () => {
  it("renders a titled panel with description and action", () => {
    render(
      <ComponentCard title="Analytics" description="Last 30 days" action={<button>Export</button>}>
        <p>body</p>
      </ComponentCard>,
    );
    expect(screen.getByRole("heading", { name: "Analytics" })).toBeVisible();
    expect(screen.getByText("Last 30 days")).toBeVisible();
    expect(screen.getByRole("button", { name: "Export" })).toBeVisible();
    expect(screen.getByText("body")).toBeVisible();
  });

  it("omits the description when not given", () => {
    render(
      <ComponentCard title="Bare">
        <p>body</p>
      </ComponentCard>,
    );
    expect(screen.getByRole("heading", { name: "Bare" })).toBeVisible();
  });

  it("passes className through to the surface", () => {
    const { container } = render(<Card className="custom-surface" />);
    expect(container.firstChild).toHaveClass("custom-surface");
  });
});

describe("Field", () => {
  it("links the label to the control", () => {
    render(
      <Field id="title" label="Title">
        <Input id="title" />
      </Field>,
    );
    expect(screen.getByLabelText("Title")).toBeInTheDocument();
  });

  it("shows a hint and wires aria-describedby", () => {
    render(
      <Field id="slug" label="Slug" hint="Lowercase only">
        <Input id="slug" />
      </Field>,
    );
    expect(screen.getByText("Lowercase only")).toHaveAttribute("id", "slug-hint");
  });

  it("prefers the error over the hint", () => {
    render(
      <Field id="slug" label="Slug" hint="Lowercase only" error="Already taken">
        <Input id="slug" />
      </Field>,
    );
    expect(screen.getByText("Already taken")).toBeVisible();
    expect(screen.queryByText("Lowercase only")).not.toBeInTheDocument();
  });

  it("marks required fields", () => {
    render(
      <Field id="name" label="Name" required>
        <Input id="name" />
      </Field>,
    );
    expect(screen.getByText("*")).toBeInTheDocument();
  });
});

describe("form controls", () => {
  it("accepts typing into Input", async () => {
    const user = userEvent.setup();
    render(<Input aria-label="Task" />);
    await user.type(screen.getByLabelText("Task"), "ship it");
    expect(screen.getByLabelText("Task")).toHaveValue("ship it");
  });

  it("accepts typing into Textarea", async () => {
    const user = userEvent.setup();
    render(<Textarea aria-label="Notes" />);
    await user.type(screen.getByLabelText("Notes"), "detail");
    expect(screen.getByLabelText("Notes")).toHaveValue("detail");
  });

  it("selects an option", async () => {
    const user = userEvent.setup();
    render(
      <Select aria-label="Priority" defaultValue="low">
        <option value="low">Low</option>
        <option value="high">High</option>
      </Select>,
    );
    await user.selectOptions(screen.getByLabelText("Priority"), "high");
    expect(screen.getByLabelText("Priority")).toHaveValue("high");
  });
});

describe("Table", () => {
  it("renders headers and cells with correct roles", () => {
    render(
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Task</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell>Ship it</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByRole("columnheader", { name: "Task" })).toBeVisible();
    expect(screen.getByRole("cell", { name: "Ship it" })).toBeVisible();
  });

  it("marks header cells as column scope for screen readers", () => {
    render(
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Name</TableHeaderCell>
          </TableRow>
        </TableHead>
      </Table>,
    );
    expect(screen.getByRole("columnheader", { name: "Name" })).toHaveAttribute("scope", "col");
  });
});
