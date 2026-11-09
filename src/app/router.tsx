import type { ComponentType } from "react";
import type { RouteObject } from "react-router";
import App from "./App";

// Each page is its own chunk, loaded on first visit.
const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({
  Component: (await load()).default,
});

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, lazy: page(() => import("../pages/HomePage")) },
      { path: "study", lazy: page(() => import("../pages/StudyPage")) },
      { path: "cards", lazy: page(() => import("../pages/CardsPage")) },
      { path: "lessons", lazy: page(() => import("../pages/LessonsPage")) },
      { path: "lessons/:slug", lazy: page(() => import("../pages/LessonPage")) },
      { path: "*", lazy: page(() => import("../pages/NotFoundPage")) },
    ],
  },
];
