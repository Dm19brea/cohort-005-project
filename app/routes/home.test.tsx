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
  it("renders the hero, call to action and stats", () => {
    const html = renderHome();

    expect(html).toContain("Learn to code,");
    expect(html).toContain("Browse Courses");
    expect(html).toContain("Available Courses");
    expect(html).toContain("Self-paced");
  });

  it("centres nothing on the page", () => {
    const html = renderHome();

    expect(html).not.toContain("text-center");
    expect(html).not.toContain("justify-center gap-4");
    expect(html).not.toMatch(/mx-auto (mt|mb)-/);
  });
});
