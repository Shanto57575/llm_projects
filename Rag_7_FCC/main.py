from dotenv import load_dotenv
from importlib.metadata import version
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
import tempfile
import os
from langchain_community.document_loaders import (
    TextLoader
)

load_dotenv()

lc_version = version("langchain")
lc_core_version = version("langchain-core")
lg_version = version("langgraph")

print(f"langchain version : {lc_version}")
print(f"langchain core version : {lc_core_version}")
print(f"langgraph version : {lg_version}")

def main():
    llm_google = ChatGoogleGenerativeAI(model="gemini-3.5-flash")
    gemini_response = llm_google.invoke("say 'setup complete' in one word")
    llm_groq = ChatGroq(model="llama-3.3-70b-versatile")
    groq_response = llm_groq.invoke("say 'setup complete' in one word")
    
    print(f"gemini version : {gemini_response}\n")
    print(f"groq version : {groq_response}")
    
def load_text_file():
    with tempfile.NamedTemporaryFile(delete=False, suffix='.txt') as temp_file:
        temp_file.write(b"Hello this is a sample text file")
        temp_file_path = temp_file.name
        
    try:
        loader = TextLoader(temp_file_path)
        documents = loader.load()
        
        print(f"Loaded {len(documents)} document(s)")
        print(f"page content : {documents[0].page_content[:100]}")
        print(f"metadata : {documents[0].metadata}")
    finally:
        os.remove(temp_file_path)

if __name__ == "__main__":
    # main()
    load_text_file()