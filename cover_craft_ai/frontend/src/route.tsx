import App from "./App";
import CoverCraftAI from "./pages/CoverCraftAI";
import Login from "./pages/Login";
import Register from "./pages/Register";
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
            },
            {
                path: "/how-it-works",
                element: <Login />
            },
            {
                path: "/pricing",
                element: <Login />
            },
            {
                path: "/about",
                element: <Login />
            },
        ]
    },
    {
        path: "/applicants-login",
        element: <Login />
    },
    {
        path: "/applicants-account-creation",
        element: <Register />
    }
])