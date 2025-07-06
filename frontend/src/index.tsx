// src/index.tsx
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css"; // your tailwind or global styles
import "react-toastify/dist/ReactToastify.css"; // import toast styles

const container = document.getElementById("root")!;
const root = createRoot(container);

root.render(<App />);
