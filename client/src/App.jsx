import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Control from "./pages/Control.jsx";
import Output from "./pages/Output.jsx";

// V1: only the two routes described in the spec exist.
// "/" redirects to "/control" since that is the operator's entry point.
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/control" replace />} />
        <Route path="/control" element={<Control />} />
        <Route path="/output" element={<Output />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
