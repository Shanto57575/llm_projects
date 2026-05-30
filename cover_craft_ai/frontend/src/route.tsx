import App from "./App";
import CoverCraftAI from "./pages/CoverCraftAI";
import { createBrowserRouter } from "react-router";

export const router = createBrowserRouter([
    {
        path: "/",
        element: <App />,
        children: [
            {
                index:true,
                path: "/",
                element: <CoverCraftAI />
            }
        ]
    }
])