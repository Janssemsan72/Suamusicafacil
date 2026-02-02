import { createRoot } from "react-dom/client";
import AdminApp from "./admin/AdminApp";
import "./admin.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error('Elemento "#root" não encontrado');
}

createRoot(rootElement).render(<AdminApp />);
