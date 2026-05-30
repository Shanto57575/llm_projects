import { FileText, Mail, Sparkles, Shield, BookOpen } from "lucide-react";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-slate-950 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer Content */}
        <div className="py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

          {/* Brand Column */}
          <div className="flex flex-col gap-4 sm:col-span-2 lg:col-span-1">
            <a href="/" className="flex items-center gap-2 group w-fit">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 group-hover:bg-indigo-500 transition-colors duration-200">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <span className="text-white font-bold text-lg tracking-tight">
                Cover<span className="text-indigo-400">Craft</span>
                <span className="text-slate-400 font-normal text-sm ml-1">AI</span>
              </span>
            </a>
            <p className="text-slate-500 text-sm leading-relaxed max-w-xs">
              AI-powered cover letters tailored to your resume and the job you want. Stand out — only if you qualify.
            </p>
            {/* Social Links */}
            <div className="flex items-center gap-3 mt-1">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all duration-200"
                aria-label="GitHub"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all duration-200"
                aria-label="Twitter"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>

              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all duration-200"
                aria-label="LinkedIn"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
              <a
                href="mailto:hello@covercraftai.com"
                className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-all duration-200"
                aria-label="Email"
              >
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Product Links */}
          <div className="flex flex-col gap-4">
            <p className="text-white text-sm font-semibold tracking-wide uppercase flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Product
            </p>
            <ul className="flex flex-col gap-2.5">
              {[
                { label: "How it Works", href: "/how-it-works" },
                { label: "Pricing", href: "/pricing" },
                { label: "Generate Cover Letter", href: "/generate" },
                { label: "My Dashboard", href: "/dashboard" },
              ].map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-slate-500 hover:text-slate-200 text-sm transition-colors duration-200"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Links */}
          <div className="flex flex-col gap-4">
            <p className="text-white text-sm font-semibold tracking-wide uppercase flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              Company
            </p>
            <ul className="flex flex-col gap-2.5">
              {[
                { label: "About Us", href: "/about" },
                { label: "Blog", href: "/blog" },
                { label: "Careers", href: "/careers" },
                { label: "Contact", href: "/contact" },
              ].map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-slate-500 hover:text-slate-200 text-sm transition-colors duration-200"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div className="flex flex-col gap-4">
            <p className="text-white text-sm font-semibold tracking-wide uppercase flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-indigo-400" />
              Legal
            </p>
            <ul className="flex flex-col gap-2.5">
              {[
                { label: "Privacy Policy", href: "/privacy" },
                { label: "Terms of Service", href: "/terms" },
                { label: "Cookie Policy", href: "/cookies" },
              ].map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-slate-500 hover:text-slate-200 text-sm transition-colors duration-200"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-slate-800 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-slate-600 text-xs">
            © {currentYear} CoverCraft AI. All rights reserved.
          </p>
          <p className="text-slate-700 text-xs flex items-center gap-1.5">
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