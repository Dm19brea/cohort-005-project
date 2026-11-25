import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router";
import Home from "./home";
import type { Route } from "./+types/home";

vi.mock("~/components/dev-ui", () => ({
  DevUI: () => null,
}));

function renderHome() {
  const loaderData = {
    featuredCourses: [],
    totalCourses: 4,
    totalCategories: 5,
    users: [],
    currentUser: null,
    devCountry: null,
    countryTierInfo: { tier: 1, discount: 0, label: "Full Price" },
    countries: [],
  };

  const props = { loaderData } as unknown as Route.ComponentProps;

  return renderToStaticMarkup(
    <StaticRouter location="/">
      <Home {...props} />
    </StaticRouter>
  );
}

describe("Home landing page", () => {
  it("left-aligns the hero section", () => {
    const html = renderHome();

    expect(html).toContain('class="mx-auto max-w-6xl px-6 py-24"');
    expect(html).not.toContain("py-24 text-center");
  });

  it("left-aligns the hero copy instead of centring it", () => {
    const html = renderHome();

    expect(html).toContain("mt-6 max-w-2xl text-lg text-muted-foreground");
    expect(html).not.toContain("mx-auto mt-6");
  });

  it("left-aligns the call-to-action row", () => {
    const html = renderHome();

    expect(html).toContain("mt-10 flex items-center gap-4");
    expect(html).not.toContain("justify-center gap-4");
  });

  it("left-aligns the stats strip", () => {
    const html = renderHome();

    expect(html).not.toContain('class="text-center"');
    expect(html).toContain("mb-3 flex size-12 items-center justify-center");
    expect(html).not.toContain("mx-auto mb-3");
  });
});
