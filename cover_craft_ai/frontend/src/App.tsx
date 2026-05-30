import { Outlet } from "react-router";
import Footer from "./components/shared/Footer";
import Navbar from "./components/shared/Navbar";

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Outlet />
      </main>
      <Footer />
    </>
  )
}
