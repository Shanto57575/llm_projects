import { useState } from "react";
import { FileText, Menu, X, LogOut, LogIn, UserPlus, Sparkles } from "lucide-react";
import { Link } from "react-router";

// Mock auth state — replace with your real auth hook/context
const useAuth = () => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    return { isLoggedIn, setIsLoggedIn };
};

export default function Navbar() {
    const { isLoggedIn, setIsLoggedIn } = useAuth();
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <nav className="w-full bg-slate-950 border-b border-slate-800 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">

                    {/* Logo */}
                    <a href="/" className="flex items-center gap-2 group">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 group-hover:bg-indigo-500 transition-colors duration-200">
                            <FileText className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-white font-bold text-lg tracking-tight">
                            Cover<span className="text-indigo-400">Craft</span>
                            <span className="text-slate-400 font-normal text-sm ml-1">AI</span>
                        </span>
                    </a>

                    {/* Desktop Nav Links */}
                    <div className="hidden md:flex items-center gap-6">
                        <a
                            href="/how-it-works"
                            className="text-slate-400 hover:text-white text-sm font-medium transition-colors duration-200"
                        >
                            How it Works
                        </a>
                        <a
                            href="/pricing"
                            className="text-slate-400 hover:text-white text-sm font-medium transition-colors duration-200"
                        >
                            Pricing
                        </a>
                        <a
                            href="/about"
                            className="text-slate-400 hover:text-white text-sm font-medium transition-colors duration-200"
                        >
                            About
                        </a>
                    </div>

                    {/* Desktop Auth Buttons */}
                    <div className="hidden md:flex items-center gap-3">
                        {isLoggedIn ? (
                            <>
                                <a
                                    href="/dashboard"
                                    className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-white font-medium transition-colors duration-200"
                                >
                                    <Sparkles className="w-4 h-4 text-indigo-400" />
                                    Dashboard
                                </a>
                                <button
                                    onClick={() => setIsLoggedIn(false)}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-sm font-medium transition-all duration-200 border border-slate-700 hover:border-slate-600"
                                >
                                    <LogOut className="w-4 h-4" />
                                    Logout
                                </button>
                            </>
                        ) : (
                            <>
                                <Link
                                    to="/applicants-login"
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-slate-300 hover:text-white text-sm font-medium transition-colors duration-200"
                                >
                                    <LogIn className="w-4 h-4" />
                                    Login
                                </Link>
                                <Link
                                    to="/applicants-account-creation"
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all duration-200 shadow-lg shadow-indigo-950"
                                >
                                    <UserPlus className="w-4 h-4" />
                                    Get Started
                                </Link>
                            </>
                        )}
                    </div>

                    {/* Mobile Menu Toggle */}
                    <button
                        onClick={() => setMenuOpen(!menuOpen)}
                        className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all duration-200"
                        aria-label="Toggle menu"
                    >
                        {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            {menuOpen && (
                <div className="md:hidden border-t border-slate-800 bg-slate-950">
                    <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-1">
                        <a
                            href="/how-it-works"
                            className="px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-medium transition-all duration-200"
                            onClick={() => setMenuOpen(false)}
                        >
                            How it Works
                        </a>
                        <a
                            href="/pricing"
                            className="px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-medium transition-all duration-200"
                            onClick={() => setMenuOpen(false)}
                        >
                            Pricing
                        </a>
                        <a
                            href="/about"
                            className="px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-sm font-medium transition-all duration-200"
                            onClick={() => setMenuOpen(false)}
                        >
                            About
                        </a>

                        <div className="border-t border-slate-800 mt-2 pt-3 flex flex-col gap-2">
                            {isLoggedIn ? (
                                <>
                                    <a
                                        href="/dashboard"
                                        className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 text-sm font-medium transition-all duration-200"
                                        onClick={() => setMenuOpen(false)}
                                    >
                                        <Sparkles className="w-4 h-4 text-indigo-400" />
                                        Dashboard
                                    </a>
                                    <button
                                        onClick={() => { setIsLoggedIn(false); setMenuOpen(false); }}
                                        className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-sm font-medium transition-all duration-200 border border-slate-700 w-full text-left"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        Logout
                                    </button>
                                </>
                            ) : (
                                <>
                                    <a
                                        href="/login"
                                        className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 text-sm font-medium transition-all duration-200"
                                        onClick={() => setMenuOpen(false)}
                                    >
                                        <LogIn className="w-4 h-4" />
                                        Login
                                    </a>
                                    <a
                                        href="/register"
                                        className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all duration-200 justify-center"
                                        onClick={() => setMenuOpen(false)}
                                    >
                                        <UserPlus className="w-4 h-4" />
                                        Get Started
                                    </a>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </nav>
    );
}