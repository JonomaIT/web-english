import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/app.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { StudyProvider } from "./app/study";
import { routes } from "./app/router";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StudyProvider>
      <RouterProvider router={createBrowserRouter(routes)} />
    </StudyProvider>
  </StrictMode>,
);
