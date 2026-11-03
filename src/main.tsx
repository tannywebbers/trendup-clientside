import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { DBInitProvider } from "./hooks/use-db-init.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <DBInitProvider>
    <App />
  </DBInitProvider>
);
