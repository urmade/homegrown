import { createElement } from "react";
import { expect, it } from "vitest";
import { Banner, Button, EmptyState, IconButton, Input, Notice, SegmentedControl, Select, TextField } from "../src/index";

it("ux.ui.button labels do not wrap and disabled exposes aria-disabled", () => {
  const el = Button({ children: "Save changes now" });
  expect(String(el.props.className)).toMatch(/whitespace-nowrap/);
  const off = Button({ disabled: true, children: "Save" });
  expect(off.props.disabled).toBe(true);
  expect(off.props["aria-disabled"]).toBe(true);
});

it("ux.ui.fields TextField and Select wire label error and aria; Input is a TextField alias", () => {
  const field = createElement(TextField, { label: "Name", error: "Required", defaultValue: "" });
  expect(field.props.label).toBe("Name");
  const alias = createElement(Input, { label: "Name", error: "Required" });
  expect(alias.props.label).toBe("Name");
  expect(alias.type).toBe(Input);
  const select = createElement(Select, {
    label: "Locale",
    error: "Pick one",
    children: createElement("option", { value: "en" }, "English"),
  });
  expect(select.props.label).toBe("Locale");
});

it("ux.ui.fields IconButton requires aria-label", () => {
  const el = createElement(IconButton, { "aria-label": "Back", children: "<" });
  expect(el.props["aria-label"]).toBe("Back");
});

it("ux.ui.chrome SegmentedControl Banner EmptyState take copy as props", () => {
  expect(
    createElement(SegmentedControl, { value: "system", onChange: () => {}, options: [{ value: "system", label: "System" }] }).props
      .options[0]?.label,
  ).toBe("System");
  expect(createElement(Banner, { children: "Offline" }).props.children).toBe("Offline");
  expect(createElement(Notice, { children: "Offline" }).props.children).toBe("Offline");
  expect(createElement(EmptyState, { children: "Nothing here" }).props.children).toBe("Nothing here");
});
