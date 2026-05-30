import { useState, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import {
    Upload, FileText, X, CheckCircle2, AlertCircle, Sparkles,
    ChevronRight, ClipboardPaste, Loader2, File, Copy, Check,
    TrendingUp, TrendingDown, Lightbulb, AlertTriangle, RotateCcw,
    BadgeCheck, Ban, Zap, Target, Brain, ClipboardList, ChevronDown, ChevronUp, XCircle,
} from "lucide-react";
import { axiosInstance } from "../lib/axios";
import axios from "axios";

// ─── Types ────────────────────────────────────────────────────────────────────

type FormValues = { jobDescription: string };

type UploadedFile = { file: File; name: string; size: string };

type Suggestion = { section: string; instruction: string };

type Assessment = {
    is_qualified: boolean;
    overall_match_percentage: number;
    experience_score: number;
    technical_skills_score: number;
    responsibilities_score: number;
    strengths: string[];
    weaknesses: string[];
    missing_required_skills: string[];
    suggestions: Suggestion[];
};

type ApiResponse = {
    qualified: boolean;
    assessment: Assessment;
    cover_letter: string | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCEPTED_TYPES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const ACCEPTED_EXTENSIONS = [".pdf", ".doc", ".docx"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

// ─── Result Sub-components ────────────────────────────────────────────────────

function OverallRing({ score }: { score: number }) {
    const radius = 52;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";
    const label = score >= 80 ? "Excellent" : score >= 60 ? "Good" : "Low";
    return (
        <div className="relative flex items-center justify-center w-32 h-32">
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r={radius} fill="none" stroke="#1e293b" strokeWidth="9" />
                <circle
                    cx="60" cy="60" r={radius} fill="none"
                    stroke={color} strokeWidth="9" strokeLinecap="round"
                    strokeDasharray={circumference} strokeDashoffset={offset}
                    style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1)" }}
                />
            </svg>
            <div className="flex flex-col items-center leading-none">
                <span className="text-white text-3xl font-bold tabular-nums">{score}</span>
                <span className="text-slate-500 text-xs mt-1">%</span>
                <span className="text-xs font-semibold mt-1" style={{ color }}>{label}</span>
            </div>
        </div>
    );
}

function ScoreBar({ label, score, icon, delay = 0 }: { label: string; score: number; icon: React.ReactNode; delay?: number }) {
    const bar = score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-rose-500";
    const text = score >= 80 ? "text-emerald-400" : score >= 60 ? "text-amber-400" : "text-rose-400";
    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-slate-500">{icon}</span>
                    <span className="text-slate-400 text-xs font-medium">{label}</span>
                </div>
                <span className={`text-xs font-bold tabular-nums ${text}`}>{score}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                    className={`h-full rounded-full ${bar} transition-all duration-1000 ease-out`}
                    style={{ width: `${score}%`, transitionDelay: `${delay}ms` }}
                />
            </div>
        </div>
    );
}

function CollapsibleSection({
    title, icon, badge, badgeColor, defaultOpen = true, children,
}: {
    title: string; icon: React.ReactNode; badge?: number;
    badgeColor?: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
            <button
                type="button" onClick={() => setOpen((p) => !p)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-800/50 transition-colors duration-150"
            >
                <div className="flex items-center gap-2.5">
                    <span className="text-slate-400">{icon}</span>
                    <span className="text-white text-sm font-semibold">{title}</span>
                    {badge !== undefined && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeColor ?? "bg-slate-700 text-slate-300"}`}>
                            {badge}
                        </span>
                    )}
                </div>
                {open ? <ChevronUp className="w-3.5 h-3.5 text-slate-600" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-600" />}
            </button>
            {open && <div className="px-5 pb-5 border-t border-slate-800/60 pt-4">{children}</div>}
        </div>
    );
}

// ─── Result View ──────────────────────────────────────────────────────────────

function ResultView({ result, onReset }: { result: ApiResponse; onReset: () => void }) {
    const { qualified, assessment, cover_letter } = result;
    const [copied, setCopied] = useState(false);
    const [letterExpanded, setLetterExpanded] = useState(false);

    const handleCopy = async () => {
        if (!cover_letter) return;
        await navigator.clipboard.writeText(cover_letter);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const paragraphs = cover_letter
        ? cover_letter.split("\n").filter((l) => l.trim() !== "")
        : [];
    const preview = paragraphs.slice(0, 4);
    const hasMore = paragraphs.length > 4;

    return (
        <div className="min-h-screen bg-slate-950 py-12 px-4">
            <div className="max-w-5xl mx-auto flex flex-col gap-5">

                {/* Status Banner */}
                <div className={`rounded-2xl border px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4 justify-between ${qualified ? "bg-emerald-950/40 border-emerald-800/50" : "bg-rose-950/30 border-rose-800/40"
                    }`}>
                    <div className="flex items-center gap-4">
                        <div className={`flex items-center justify-center w-11 h-11 rounded-xl shrink-0 ${qualified ? "bg-emerald-500/15 border border-emerald-500/30" : "bg-rose-500/15 border border-rose-500/30"
                            }`}>
                            {qualified ? <BadgeCheck className="w-6 h-6 text-emerald-400" /> : <Ban className="w-6 h-6 text-rose-400" />}
                        </div>
                        <div>
                            <p className={`text-sm font-bold ${qualified ? "text-emerald-300" : "text-rose-300"}`}>
                                {qualified ? "You qualify for this role!" : "You don't meet the requirements for this role"}
                            </p>
                            <p className="text-slate-500 text-xs mt-0.5">
                                {qualified
                                    ? "Your profile matched successfully. Your AI cover letter is ready below."
                                    : "Our AI reviewed your profile against the job description. See the breakdown below."}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onReset}
                        className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white text-xs font-semibold transition-all duration-200 shrink-0 self-start sm:self-auto"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Try Another Role
                    </button>
                </div>

                {/* Main Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

                    {/* Left: Scores */}
                    <div className="lg:col-span-1 flex flex-col gap-5">
                        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-4">Overall Match Score</p>
                            <div className="flex flex-col items-center gap-5">
                                <OverallRing score={assessment.overall_match_percentage} />
                                <div className="w-full flex flex-col gap-3.5">
                                    <ScoreBar label="Technical Skills" score={assessment.technical_skills_score} icon={<Brain className="w-3.5 h-3.5" />} delay={0} />
                                    <ScoreBar label="Experience" score={assessment.experience_score} icon={<Zap className="w-3.5 h-3.5" />} delay={150} />
                                    <ScoreBar label="Responsibilities" score={assessment.responsibilities_score} icon={<Target className="w-3.5 h-3.5" />} delay={300} />
                                </div>
                            </div>
                        </div>

                        {assessment.missing_required_skills.length > 0 && (
                            <div className="rounded-2xl border border-amber-800/40 bg-amber-950/20 p-5">
                                <div className="flex items-center gap-2 mb-3">
                                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                                    <p className="text-amber-300 text-xs font-semibold uppercase tracking-wider">Missing Skills</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {assessment.missing_required_skills.map((skill) => (
                                        <span key={skill} className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-medium">
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Details */}
                    <div className="lg:col-span-2 flex flex-col gap-4">

                        <CollapsibleSection
                            title="Strengths" icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}
                            badge={assessment.strengths.length} badgeColor="bg-emerald-500/15 text-emerald-400"
                        >
                            <ul className="flex flex-col gap-3">
                                {assessment.strengths.map((s, i) => (
                                    <li key={i} className="flex items-start gap-3">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                        <span className="text-slate-300 text-sm leading-relaxed">{s}</span>
                                    </li>
                                ))}
                            </ul>
                        </CollapsibleSection>

                        <CollapsibleSection
                            title="Weaknesses" icon={<TrendingDown className="w-4 h-4 text-rose-400" />}
                            badge={assessment.weaknesses.length} badgeColor="bg-rose-500/15 text-rose-400"
                        >
                            <ul className="flex flex-col gap-3">
                                {assessment.weaknesses.map((w, i) => (
                                    <li key={i} className="flex items-start gap-3">
                                        <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                        <span className="text-slate-300 text-sm leading-relaxed">{w}</span>
                                    </li>
                                ))}
                            </ul>
                        </CollapsibleSection>

                        {assessment.suggestions.length > 0 && (
                            <CollapsibleSection
                                title="Resume Improvement Suggestions" icon={<Lightbulb className="w-4 h-4 text-amber-400" />}
                                badge={assessment.suggestions.length} badgeColor="bg-amber-500/15 text-amber-400" defaultOpen={false}
                            >
                                <div className="flex flex-col gap-3">
                                    {assessment.suggestions.map((s, i) => (
                                        <div key={i} className="flex gap-3 p-4 rounded-xl bg-slate-800/70 border border-slate-700/50">
                                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold shrink-0 mt-0.5">
                                                {i + 1}
                                            </span>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-amber-400 text-xs font-semibold uppercase tracking-wider">{s.section}</span>
                                                <p className="text-slate-300 text-sm leading-relaxed">{s.instruction}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CollapsibleSection>
                        )}

                        {/* Cover Letter — Qualified */}
                        {qualified && cover_letter ? (
                            <div className="rounded-xl border border-indigo-800/50 bg-slate-900 overflow-hidden">
                                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-indigo-950/30">
                                    <div className="flex items-center gap-2.5">
                                        <ClipboardList className="w-4 h-4 text-indigo-400" />
                                        <span className="text-white text-sm font-semibold">Your Cover Letter</span>
                                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 text-xs font-medium">
                                            <Sparkles className="w-3 h-3" />AI Generated
                                        </span>
                                    </div>
                                    <button
                                        onClick={handleCopy}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium transition-all duration-200 text-slate-300 hover:text-white"
                                    >
                                        {copied
                                            ? <><Check className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400">Copied!</span></>
                                            : <><Copy className="w-3.5 h-3.5" />Copy</>
                                        }
                                    </button>
                                </div>
                                <div className="relative px-6 py-5">
                                    <div className="absolute left-0 top-5 bottom-5 w-0.5 bg-linear-to-b from-indigo-500/60 via-violet-500/40 to-transparent rounded-full" />
                                    <div className="flex flex-col gap-4 pl-4">
                                        {(letterExpanded ? paragraphs : preview).map((line, i) => (
                                            <p key={i} className="text-slate-300 text-sm leading-7">{line}</p>
                                        ))}
                                    </div>
                                    {hasMore && !letterExpanded && (
                                        <div className="absolute bottom-0 left-0 right-0 h-20 bg-linear-to-t from-slate-900 to-transparent flex items-end justify-center pb-3">
                                            <button
                                                onClick={() => setLetterExpanded(true)}
                                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-all duration-200"
                                            >
                                                <ChevronDown className="w-3.5 h-3.5" />Read Full Letter
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {letterExpanded && hasMore && (
                                    <div className="px-10 pb-5">
                                        <button
                                            onClick={() => setLetterExpanded(false)}
                                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white text-xs font-medium transition-all duration-200"
                                        >
                                            <ChevronUp className="w-3.5 h-3.5" />Collapse
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : !qualified ? (
                            <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-6 py-8 flex flex-col items-center gap-4 text-center">
                                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-slate-800 border border-slate-700">
                                    <Ban className="w-6 h-6 text-slate-600" />
                                </div>
                                <div>
                                    <p className="text-white text-sm font-semibold">Cover Letter Not Generated</p>
                                    <p className="text-slate-500 text-xs mt-1.5 max-w-sm leading-relaxed">
                                        Your profile doesn't meet the minimum requirements. Use the suggestions above to strengthen your resume, then try again.
                                    </p>
                                </div>
                                <button
                                    onClick={onReset}
                                    className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all duration-200"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />Try a Different Role
                                </button>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CoverCraftAI() {
    const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
    const [fileError, setFileError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<ApiResponse | null>(null);
    const [apiError, setApiError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { register, handleSubmit, watch, formState: { errors }, reset: resetForm } =
        useForm<FormValues>({ mode: "onChange" });

    const charCount = watch("jobDescription", "")?.length ?? 0;

    const validateFile = (file: File): string | null => {
        if (!ACCEPTED_TYPES.includes(file.type)) return "Only PDF, DOC, or DOCX files are accepted.";
        if (file.size > 5 * 1024 * 1024) return "File size must be under 5 MB.";
        return null;
    };

    const handleFile = (file: File) => {
        const error = validateFile(file);
        if (error) { setFileError(error); setUploadedFile(null); return; }
        setFileError(null);
        setUploadedFile({ file, name: file.name, size: formatBytes(file.size) });
    };

    const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault(); setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
    }, []);

    const removeFile = () => {
        setUploadedFile(null); setFileError(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleReset = () => {
        setResult(null); setApiError(null); removeFile(); resetForm();
    };

    const onSubmit = async (data: FormValues) => {
        if (!uploadedFile) { setFileError("Please upload your resume before submitting."); return; }
        setIsSubmitting(true);
        setApiError(null);
        try {
            const formData = new FormData();
            formData.append("resume", uploadedFile.file);
            formData.append("job_description", data.jobDescription);
            const response = await axiosInstance.post<ApiResponse>("/generate-cover-letter", formData);
            console.log("response==>", response)
            setResult(response.data);
        } catch (err) {
            console.log("err", err)
            if (axios.isAxiosError(err)) {
                const detail = err.response?.data?.detail;

                if (typeof detail === "string") {
                    setApiError(detail);
                } else if (Array.isArray(detail)) {
                    setApiError(detail.map((d) => d.msg).join(" · "));
                } else {
                    setApiError("Something went wrong. Please try again.");
                }
            } else {
                setApiError("Something went wrong. Please try again.");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const getCharColor = () => {
        if (charCount < 100) return "text-rose-400";
        if (charCount > 9500) return "text-amber-400";
        return "text-emerald-400";
    };

    if (result) return <ResultView result={result} onReset={handleReset} />;

    // ── Form ──
    return (
        <div className="min-h-screen bg-slate-950 py-16 px-4">
            <div className="max-w-3xl mx-auto text-center mb-12">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-600/15 border border-indigo-500/25 mb-5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-indigo-300 text-xs font-semibold tracking-wider uppercase">AI-Powered Cover Letters</span>
                </div>
                <h1 className="text-white text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
                    Let the right job{" "}
                    <span className="text-transparent bg-clip-text bg-linear-to-r from-indigo-400 to-violet-400">
                        find your words
                    </span>
                </h1>
                <p className="text-slate-400 mt-4 text-base leading-relaxed max-w-xl mx-auto">
                    Upload your resume and paste the job description. Our AI evaluates your fit — and only crafts a cover letter if you qualify.
                </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl mx-auto" noValidate>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl shadow-slate-950">

                    {/* Step tabs */}
                    <div className="flex border-b border-slate-800">
                        <div className="flex-1 flex items-center gap-3 px-6 py-4 border-r border-slate-800">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold shrink-0">1</span>
                            <div>
                                <p className="text-white text-sm font-semibold">Resume</p>
                                <p className="text-slate-500 text-xs">Upload your CV</p>
                            </div>
                        </div>
                        <div className="flex-1 flex items-center gap-3 px-6 py-4">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-700 text-slate-300 text-xs font-bold shrink-0">2</span>
                            <div>
                                <p className="text-white text-sm font-semibold">Job Description</p>
                                <p className="text-slate-500 text-xs">Paste the listing</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 sm:p-8 flex flex-col gap-8">

                        {/* API Error */}
                        {apiError && (
                            <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-rose-500/8 border border-rose-500/30">
                                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                                <p className="text-rose-300 text-sm leading-relaxed">{apiError}</p>
                            </div>
                        )}

                        {/* Resume Upload */}
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <label className="text-white text-sm font-semibold flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-indigo-400" />Resume / CV
                                </label>
                                <span className="text-slate-600 text-xs">PDF, DOC, DOCX · Max 5 MB</span>
                            </div>

                            {!uploadedFile ? (
                                <div
                                    onDrop={onDrop}
                                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                    onDragLeave={() => setIsDragging(false)}
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`flex flex-col items-center justify-center gap-4 px-6 py-12 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 group ${isDragging ? "border-indigo-500 bg-indigo-600/10"
                                        : fileError ? "border-rose-500/50 bg-rose-500/5 hover:border-rose-400/70"
                                            : "border-slate-700 bg-slate-800/40 hover:border-indigo-500/60 hover:bg-indigo-600/5"
                                        }`}
                                >
                                    <input
                                        ref={fileInputRef} type="file"
                                        accept={ACCEPTED_EXTENSIONS.join(",")}
                                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                                        className="hidden"
                                    />
                                    <div className={`flex items-center justify-center w-14 h-14 rounded-xl border transition-all duration-200 ${isDragging ? "bg-indigo-600/20 border-indigo-500/40" : "bg-slate-800 border-slate-700 group-hover:bg-indigo-600/10 group-hover:border-indigo-500/30"
                                        }`}>
                                        <Upload className={`w-6 h-6 transition-colors ${isDragging ? "text-indigo-400" : "text-slate-400 group-hover:text-indigo-400"}`} />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-slate-300 text-sm font-medium">
                                            {isDragging ? "Drop your file here" : "Drag & drop your resume"}
                                        </p>
                                        <p className="text-slate-600 text-xs mt-1">
                                            or <span className="text-indigo-400 font-medium">browse to upload</span>
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-4 px-4 py-4 rounded-xl bg-slate-800/60 border border-slate-700">
                                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-600/20 border border-indigo-500/30 shrink-0">
                                        <File className="w-5 h-5 text-indigo-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white text-sm font-medium truncate">{uploadedFile.name}</p>
                                        <p className="text-slate-500 text-xs mt-0.5">{uploadedFile.size}</p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                        <button type="button" onClick={removeFile}
                                            className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-200">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {fileError && (
                                <div className="flex items-center gap-2 text-rose-400 text-xs">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />{fileError}
                                </div>
                            )}
                        </div>

                        {/* Divider */}
                        <div className="flex items-center gap-4">
                            <div className="flex-1 h-px bg-slate-800" />
                            <ChevronRight className="w-4 h-4 text-slate-600" />
                            <div className="flex-1 h-px bg-slate-800" />
                        </div>

                        {/* Job Description */}
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <label htmlFor="jobDescription" className="text-white text-sm font-semibold flex items-center gap-2">
                                    <ClipboardPaste className="w-4 h-4 text-indigo-400" />Job Description
                                </label>
                                <span className={`text-xs font-mono tabular-nums transition-colors duration-200 ${getCharColor()}`}>
                                    {charCount.toLocaleString()} / 10,000
                                </span>
                            </div>
                            <div className="relative">
                                <textarea
                                    id="jobDescription"
                                    {...register("jobDescription", {
                                        required: "Job description is required.",
                                        minLength: { value: 100, message: "Must be at least 100 characters." },
                                        maxLength: { value: 10000, message: "Cannot exceed 10,000 characters." },
                                        validate: {
                                            minWords: (v) => v.trim().split(/\s+/).filter(Boolean).length >= 30 || "Please include at least 30 words.",
                                            noWhitespaceOnly: (v) => v.trim().length >= 100 || "Please enter a meaningful job description.",
                                        },
                                    })}
                                    placeholder="Paste the full job description here — include the role, responsibilities, required skills, and qualifications…"
                                    rows={10}
                                    maxLength={10000}
                                    className={`w-full px-4 py-3.5 rounded-xl text-sm leading-relaxed resize-none bg-slate-800/60 border text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all duration-200 ${errors.jobDescription ? "border-rose-500/60" : "border-slate-700 focus:border-indigo-500/60 hover:border-slate-600"
                                        }`}
                                />
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-xl overflow-hidden bg-slate-700">
                                    <div
                                        className={`h-full transition-all duration-300 ${charCount < 100 ? "bg-rose-500" : charCount > 9500 ? "bg-amber-500" : "bg-emerald-500"}`}
                                        style={{ width: `${Math.min((charCount / 10000) * 100, 100)}%` }}
                                    />
                                </div>
                            </div>
                            {errors.jobDescription ? (
                                <div className="flex items-center gap-2 text-rose-400 text-xs">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />{errors.jobDescription.message}
                                </div>
                            ) : charCount >= 100 ? (
                                <div className="flex items-center gap-2 text-emerald-500 text-xs">
                                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />Looks good — detailed descriptions improve match accuracy
                                </div>
                            ) : charCount > 0 ? (
                                <div className="flex items-center gap-2 text-slate-500 text-xs">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />{100 - charCount} more characters needed
                                </div>
                            ) : null}
                        </div>

                        {/* Submit */}
                        <div className="flex flex-col gap-3 pt-2">
                            <button
                                type="submit" disabled={isSubmitting}
                                className="flex items-center justify-center gap-2.5 w-full py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all duration-200 shadow-lg shadow-indigo-950/60 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                            >
                                {isSubmitting
                                    ? <><Loader2 className="w-4 h-4 animate-spin" />Analyzing your profile…</>
                                    : <><Sparkles className="w-4 h-4" />Generate Cover Letter<ChevronRight className="w-4 h-4 ml-auto" /></>
                                }
                            </button>
                            <p className="text-slate-600 text-xs text-center">
                                A cover letter is only generated if our AI determines you meet the role's requirements.{" "}
                                <a href="/terms" className="text-slate-500 hover:text-slate-300 underline underline-offset-2 transition-colors">Terms</a> apply.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-6 mt-8">
                    {[{ icon: "🔒", label: "Resume never stored" }, { icon: "⚡", label: "Results in under 30s" }, { icon: "🎯", label: "Qualification-gated AI" }].map((b) => (
                        <div key={b.label} className="flex items-center gap-2 text-slate-600 text-xs">
                            <span>{b.icon}</span><span>{b.label}</span>
                        </div>
                    ))}
                </div>
            </form>
        </div>
    );
}

