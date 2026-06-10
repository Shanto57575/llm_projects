from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.chat_history import InMemoryChatMessageHistory
from langchain_core.messages import SystemMessage
from dotenv import load_dotenv

load_dotenv()

summary_threshold = 10
keep_recent = 4

summarizer = ChatGroq(model="llama-3.1-8b-instant", temperature=0)

summary_prompt = ChatPromptTemplate.from_messages([
    ("human", """Summarize the following conversation in 3-4 sentences.
                Keep the key facts: what the user's problem is, what was tried, what was resolved.
                {history}
                Summary:
    """)
])

class SummarizingHistory(InMemoryChatMessageHistory):
    async def aget_messages(self):
        msgs = self.messages
        if(len(msgs) <= summary_threshold):
            return msgs
        
        to_summarize = msgs[:-keep_recent] # [0:-4]
        recent = msgs[-keep_recent:] # [-4:]
        
        history_lines = []
        for m in to_summarize:
            line = f"{'User' if m.type=='human' else 'Bot'} : {m.content}"
            history_lines.append(line)
        history_text = "\n".join(history_lines)
        
        summary_chain = summary_prompt | summarizer
        summary = await summary_chain.ainvoke({"history" : history_text})
        
        return [
            SystemMessage(content=f"Earlier conversation summary: {summary.content}"),
            *recent
        ]