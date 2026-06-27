import streamlit as st
import requests
import os

API_BASE = os.getenv("API_BASE", "http://localhost:8000")

st.set_page_config(
    page_title="DocVault",
    page_icon="🗄️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Custom Sleek Theme Styles
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght=400;500;600;700&display=swap');

html, body, [class*="css"] { font-family: 'Inter', sans-serif; }
.stApp { background: #0d0d14; color: #e2e8f0; }

[data-testid="stSidebar"] {
    background: #0a0a10 !important;
    border-right: 1px solid #1e1e2e;
}

#MainMenu, footer { visibility: hidden; }
[data-testid="stHeader"] { background: transparent !important; } 

/* Sidebar Button styling */
.stSidebar .stButton > button {
    background: #6366f1 !important;
    color: white !important;
    border: none !important;
    border-radius: 8px !important;
    font-weight: 600 !important;
    font-size: 14px !important;
    width: 100% !important;
    padding: 0.5rem 1rem !important;
}
.stSidebar .stButton > button:hover { background: #4f46e5 !important; }
.stSidebar .stButton > button:disabled { background: #2d2d44 !important; color: #64748b !important; }

/* Dynamic Document Pill Badge */
.doc-pill {
    background: #1e1e2e;
    border: 1px solid #2d2d44;
    border-radius: 8px;
    padding: 10px;
    margin-bottom: 8px;
    font-size: 13px;
    color: #e2e8f0;
}
.doc-pill span { color: #64748b; font-size: 11px; display: block; margin-top: 2px; }

/* Source Badges Panel */
.sources-container {
    margin-top: 12px;
    padding-top: 8px;
    border-top: 1px solid #2d2d44;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}
.source-tag {
    background: #1e1e2e;
    border: 1px solid #3b82f6;
    color: #60a5fa;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-family: monospace;
}
</style>
""", unsafe_allow_html=True)

if "messages" not in st.session_state:
    st.session_state.messages = []
if "indexed_docs" not in st.session_state:
    st.session_state.indexed_docs = []

def upload_pdfs(files):
    file_tuples = [("files", (f.name, f.getvalue(), "application/pdf")) for f in files]
    r = requests.post(f"{API_BASE}/upload-pdf", files=file_tuples, timeout=180)
    r.raise_for_status()
    return r.json()

def ask_question(question):
    r = requests.post(f"{API_BASE}/ask-question", json={"question": question}, timeout=60)
    r.raise_for_status()
    return r.json()

# Sidebar Setup
with st.sidebar:
    st.markdown("## 🗄️ DocVault")
    st.markdown("<p style='color:#64748b; font-size:13px; margin-top:-8px;'>PDF Q&A powered by RAG</p>", unsafe_allow_html=True)
    st.divider()

    st.markdown("**Upload PDFs**")
    uploaded_files = st.file_uploader(
        "Choose PDF files",
        type=["pdf"],
        accept_multiple_files=True,
        label_visibility="collapsed",
    )

    is_upload_complete = False
    if uploaded_files:
        is_upload_complete = all(f.size > 0 for f in uploaded_files)

    if st.button("Index documents", disabled=not is_upload_complete):
        with st.spinner("Uploading and indexing..."):
            try:
                result = upload_pdfs(uploaded_files)
                for doc in result["documents"]:
                    if not any(d["filename"] == doc["filename"] for d in st.session_state.indexed_docs):
                        st.session_state.indexed_docs.append(doc)
                st.success(f"✓ {len(result['documents'])} file(s) indexed")
            except Exception as e:
                st.error(f"Failed: {str(e)}")

    if st.session_state.indexed_docs:
        st.divider()
        st.markdown("**Indexed documents**")
        for doc in st.session_state.indexed_docs:
            st.markdown(f"""
            <div class="doc-pill">
                📄 <b>{doc['filename']}</b>
                <span>{doc['total_pages']} pages · {doc['total_chunks']} chunks</span>
            </div>
            """, unsafe_allow_html=True)

    st.divider()
    if st.button("Clear chat"):
        st.session_state.messages = []
        st.rerun()

# Main Workspace Layout
st.markdown("### Ask anything about your documents")

if not st.session_state.indexed_docs:
    st.markdown("""
    <div style="text-align:center; padding:6rem 2rem; color:#64748b;">
        <div style="font-size:56px; margin-bottom:1rem;">📂</div>
        <div style="font-size:16px; font-weight:500; color:#e2e8f0;">No documents indexed yet</div>
        <div style="font-size:13px; margin-top:4px;">Upload documents via the sidebar to access insights.</div>
    </div>
    """, unsafe_allow_html=True)
else:
    # Render Chat History beautifully with native wrappers
    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]):
            st.write(msg["content"])
            if msg.get("sources"):
                tags = "".join(f'<span class="source-tag">📄 {s["filename"]} (p. {s["page"]})</span>' for s in msg["sources"])
                st.markdown(f'<div class="sources-container">{tags}</div>', unsafe_allow_html=True)

    # Fluid, Bottom-Pinned Native Chat Bar
    if question := st.chat_input("Ask a question about your documents..."):
        # Instant UI render for the User
        with st.chat_message("user"):
            st.write(question)
        st.session_state.messages.append({"role": "user", "content": question})
        
        # Assistant Workspace Processing
        with st.chat_message("assistant"):
            with st.spinner("Thinking..."):
                try:
                    result = ask_question(question)
                    response_text = result["response"]
                    sources = result.get("sources", [])
                    
                    st.write(response_text)
                    if sources:
                        tags = "".join(f'<span class="source-tag">📄 {s["filename"]} (p. {s["page"]})</span>' for s in sources)
                        st.markdown(f'<div class="sources-container">{tags}</div>', unsafe_allow_html=True)
                    
                    st.session_state.messages.append({
                        "role": "assistant",
                        "content": response_text,
                        "sources": sources
                    })
                except Exception as e:
                    error_msg = f"Error processing request: {str(e)}"
                    st.error(error_msg)
                    st.session_state.messages.append({
                        "role": "assistant",
                        "content": error_msg,
                        "sources": []
                    })
        st.rerun()