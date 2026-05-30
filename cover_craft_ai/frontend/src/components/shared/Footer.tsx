import { Sparkles } from "lucide-react";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-slate-950 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Bottom Bar */}
        <div className="border-t border-slate-800 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-slate-500 text-xs">
            © {currentYear} CoverCraft AI. All rights reserved.
          </p>
          <p className="text-slate-500 text-xs flex items-center gap-1.5">
            Only the qualified get the letter.
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-indigo-600">
              <Sparkles className="w-2.5 h-2.5 text-white" />
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}