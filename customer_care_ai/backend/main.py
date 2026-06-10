import streamlit as st
from datetime import datetime
from dotenv import load_dotenv
from langchain_mistralai import ChatMistralAI
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from memory import SummarizingHistory

load_dotenv()

# 1. Page Configuration & Title
st.set_page_config(page_title="GadgetUniverse Support", page_icon="🤖", layout="centered")
st.title("🤖 GadgetUniverse Customer Support")
st.caption("Chat with gadzX, your virtual assistant.")

# 2. Initialize Session State for Chat History Store & Timestamps
if "store" not in st.session_state:
    st.session_state.store = {}

# Custom tracking for message timestamps since LangChain's default BaseMessage doesn't store them
if "timestamps" not in st.session_state:
    st.session_state.timestamps = []

def get_session_history(session_id: str) -> SummarizingHistory:
    if session_id not in st.session_state.store:
        st.session_state.store[session_id] = SummarizingHistory()
    return st.session_state.store[session_id]

# 3. Initialize the LangChain Components
@st.cache_resource
def get_chat_chain():
    prompt = ChatPromptTemplate.from_messages([
        (
            "system",
            """
            You are a helpful, empathetic, and professional customer support assistant for 'GadgetUniverse'.
            Your Name is gadzX, Your goal is to resolve issues effectively. If you do not know the answer to a question,
            politely tell the customer you will look into it, or offer to escalate to a human agent.
            Never make up policies or order details.
            """
        ),   
        MessagesPlaceholder("chat_history", optional=True),
        ("human", "{question}")
    ])

    llm = ChatMistralAI(model="mistral-medium-2505")
    parser = StrOutputParser()
    chain = prompt | llm | parser

    return RunnableWithMessageHistory(
        chain, 
        get_session_history,
        input_messages_key="question",
        history_messages_key="chat_history"
    )

chat_with_history = get_chat_chain()
SESSION_ID = "support_session_1"

# --- Sidebar for Support Context & Actions ---
with st.sidebar:
    st.header("Support Dashboard")
    st.info("📍 **Session ID:** `support_session_1`")
    
    if st.button("🙋‍♂️ Escalate to Human Agent", use_container_width=True):
        st.warning("Connecting you to a human agent... please hold.")
        
    if st.button("🗑️ Clear Chat Session", type="primary", use_container_width=True):
        if SESSION_ID in st.session_state.store:
            st.session_state.store[SESSION_ID].clear() 
        st.session_state.timestamps = []  # Clear timestamps
        st.rerun()

# 4. Display Existing Chat History with Names and Timestamps
history_instance = get_session_history(SESSION_ID)

for idx, msg in enumerate(history_instance.messages):
    # Determine roles and cleaner display names
    if msg.type == "human":
        role = "user"
        display_name = "You"
    else:
        role = "assistant"
        display_name = "gadzX (Assistant)"
    
    # Fallback to current time if historical array boundary goes out of sync
    time_str = st.session_state.timestamps[idx] if idx < len(st.session_state.timestamps) else datetime.now().strftime("%I:%M %p")

    with st.chat_message(role):
        st.markdown(f"**{display_name}** <span style='color:gray; font-size:12px; margin-left:10px;'>{time_str}</span>", unsafe_allow_html=True)
        st.markdown(msg.content)

# 5. Handle New User Input
if customer_question := st.chat_input("How can I help you today?"):
    
    current_time = datetime.now().strftime("%I:%M %p")
    st.session_state.timestamps.append(current_time) # Save user timestamp
    
    # Display user message immediately with "You" heading and current time
    with st.chat_message("user"):
        st.markdown(f"**You** <span style='color:gray; font-size:12px; margin-left:10px;'>{current_time}</span>", unsafe_allow_html=True)
        st.markdown(customer_question)

    # Stream the AI response into the UI
    with st.chat_message("assistant"):
        response_placeholder = st.empty()
        full_ai_message = ""
        
        # Support-themed loader that disappears as soon as chunks arrive
        with st.spinner("gadzX is looking into that..."):
            chunks = chat_with_history.stream(
                {"question": customer_question},
                config={"configurable": {"session_id": SESSION_ID}}
            )
            # Fetch the first chunk inside the spinner context to dismiss loader instantly
            try:
                first_chunk = next(chunks)
                full_ai_message += first_chunk
                
                # Append assistant timestamp right as response begins arriving
                ai_time = datetime.now().strftime("%I:%M %p")
                st.session_state.timestamps.append(ai_time)
                
                response_placeholder.markdown(f"**gadzX (Assistant)** <span style='color:gray; font-size:12px; margin-left:10px;'>{ai_time}</span>\n\n{full_ai_message}▌", unsafe_allow_html=True)
            except StopIteration:
                pass
        
        # Stream the remaining chunks dynamically
        for chunk in chunks:
            full_ai_message += chunk
            response_placeholder.markdown(f"**gadzX (Assistant)** <span style='color:gray; font-size:12px; margin-left:10px;'>{ai_time}</span>\n\n{full_ai_message}▌", unsafe_allow_html=True)
            
        # Final display clean up
        response_placeholder.markdown(f"**gadzX (Assistant)** <span style='color:gray; font-size:12px; margin-left:10px;'>{ai_time}</span>\n\n{full_ai_message}", unsafe_allow_html=True)