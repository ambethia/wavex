import { describe, expect, it } from "vitest";
import { applyHead } from "../src/index.js";

class FakeElement {
  readonly attributes = new Map<string, string>();
  parentNode: FakeHead | undefined;
  textContent = "";

  constructor(readonly tagName: string) {}

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  getAttributeNames(): string[] {
    return [...this.attributes.keys()];
  }

  remove(): void {
    this.parentNode?.removeChild(this);
  }
}

class FakeHead {
  readonly children: FakeElement[] = [];

  append(element: FakeElement): void {
    element.parentNode = this;
    this.children.push(element);
  }

  querySelector(selector: string): FakeElement | null {
    if (selector === "title") return this.children.find((element) => element.tagName === "title") ?? null;
    return null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    if (selector === "[data-wx-head]") return this.children.filter((element) => element.attributes.has("data-wx-head"));
    return [];
  }

  removeChild(element: FakeElement): void {
    const index = this.children.indexOf(element);
    if (index >= 0) this.children.splice(index, 1);
    element.parentNode = undefined;
  }
}

class FakeDocument {
  readonly head = new FakeHead();
  title = "";

  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName);
  }
}

describe("applyHead", () => {
  it("keeps a prerendered managed title when the current route declares one", () => {
    const documentRef = new FakeDocument();
    const title = documentRef.createElement("title");
    title.textContent = "Prerendered";
    title.setAttribute("data-wx-head", "");
    documentRef.head.append(title);
    const staleMeta = documentRef.createElement("meta");
    staleMeta.setAttribute("data-wx-head", "");
    documentRef.head.append(staleMeta);

    applyHead([{ tag: "title", text: "Hydrated" }], documentRef as never);

    expect(documentRef.title).toBe("Hydrated");
    expect(title.textContent).toBe("Hydrated");
    expect(documentRef.head.children).toContain(title);
    expect(documentRef.head.children).not.toContain(staleMeta);
  });

  it("marks runtime-created titles as managed so later routes can remove them", () => {
    const documentRef = new FakeDocument();

    applyHead([{ tag: "title", text: "First" }], documentRef as never);

    const title = documentRef.head.children[0];
    expect(title?.tagName).toBe("title");
    expect(title?.attributes.has("data-wx-head")).toBe(true);

    applyHead([], documentRef as never);

    expect(documentRef.head.children).toEqual([]);
  });
});
