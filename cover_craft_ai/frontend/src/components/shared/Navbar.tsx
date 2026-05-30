import { FileText } from "lucide-react";
import { Link } from "react-router";

export default function Navbar() {
    return (
        <nav className="bg-slate-950 flex items-center justify-center py-5">
            <Link to="/" className="flex items-center gap-2 group">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 group-hover:bg-indigo-500 transition-colors duration-200">
                    <FileText className="w-4 h-4 text-white" />
                </div>
                <span className="text-white font-bold text-xl tracking-tight">
                    Cover<span className="text-indigo-400">Craft</span>
                    <span className="text-white font-serif text-sm ml-1">AI</span>
                </span>
            </Link>
        </nav>
    );
}