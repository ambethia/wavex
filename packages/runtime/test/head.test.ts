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
    const match = selector.match(/^(meta|link)\[(name|property|rel)="(.+)"\](\[data-wx-head\])?$/);
    if (!match) return null;
    const [, tagName, attribute, rawValue, managedSelector] = match;
    const value = rawValue.replace(/\\\\/g, "\\").replace(/\\"/g, '"');
    return (
      this.children.find((element) => {
        return (
          element.tagName === tagName &&
          element.attributes.get(attribute) === value &&
          (!managedSelector || element.attributes.has("data-wx-head"))
        );
      }) ?? null
    );
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

  it("reconciles only managed meta and link nodes that collide with static index.html head content", () => {
    const documentRef = new FakeDocument();
    const staticMeta = documentRef.createElement("meta");
    staticMeta.setAttribute("name", "description");
    staticMeta.setAttribute("content", "Static description");
    documentRef.head.append(staticMeta);
    const staticCanonical = documentRef.createElement("link");
    staticCanonical.setAttribute("rel", "canonical");
    staticCanonical.setAttribute("href", "/static");
    documentRef.head.append(staticCanonical);

    applyHead(
      [
        { tag: "meta", attributes: { name: "description", content: "First" } },
        { tag: "link", attributes: { rel: "canonical", href: "/first" } }
      ],
      documentRef as never
    );

    const description = documentRef.head.children.find((element) => {
      return element !== staticMeta && element.attributes.get("name") === "description";
    });
    const canonical = documentRef.head.children.find((element) => {
      return element !== staticCanonical && element.attributes.get("rel") === "canonical";
    });
    expect(staticMeta.attributes.get("content")).toBe("Static description");
    expect(staticCanonical.attributes.get("href")).toBe("/static");
    expect(description?.attributes.get("content")).toBe("First");
    expect(canonical?.attributes.get("href")).toBe("/first");

    applyHead([{ tag: "meta", attributes: { name: "description", content: "Second" } }], documentRef as never);

    expect(documentRef.head.children).toContain(staticMeta);
    expect(documentRef.head.children).toContain(staticCanonical);
    expect(documentRef.head.children).toContain(description);
    expect(staticMeta.attributes.get("content")).toBe("Static description");
    expect(staticCanonical.attributes.get("href")).toBe("/static");
    expect(description?.attributes.get("content")).toBe("Second");
    expect(documentRef.head.children).not.toContain(canonical);
  });
});
