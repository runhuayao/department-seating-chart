import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import ServerManagementRoot from "./pages/ServerManagementRoot";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ServerManagementRoot />
  </StrictMode>
);