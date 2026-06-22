# load_playbook.py
# โหลด playbook PDF เข้า ChromaDB

import chromadb
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_ollama import OllamaEmbeddings
import os

# ชี้ไปที่ไฟล์ PDF
PDF_PATH = r"C:\Users\ripti.LINGGANGGULI\Downloads\ร่าง คู่มือปฏิบัติการทางไซเบอร์_ed2.pdf"

def load_playbook():
    print("กำลังโหลด PDF...")
    loader = PyPDFLoader(PDF_PATH)
    pages = loader.load()
    print(f"โหลดได้ {len(pages)} หน้า")

    # ตัดแบ่ง text เป็น chunks
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=100,
        separators=["\n\n", "\n", ".", " "]
    )
    chunks = splitter.split_documents(pages)
    print(f"แบ่งได้ {len(chunks)} chunks")

    # สร้าง embeddings ผ่าน Ollama
    print("กำลัง embed... (ใช้เวลาสักครู่)")
    embeddings = OllamaEmbeddings(model="nomic-embed-text")

    # สร้าง ChromaDB
    client = chromadb.PersistentClient(path="./chroma_db")

    # ลบ collection เดิมถ้ามี แล้วสร้างใหม่
    try:
        client.delete_collection("playbook")
    except:
        pass

    collection = client.create_collection(
        name="playbook",
        metadata={"hnsw:space": "cosine"}
    )

    # ใส่ข้อมูลเข้า ChromaDB
    batch_size = 10
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i+batch_size]
        texts = [c.page_content for c in batch]
        ids = [f"chunk_{i+j}" for j in range(len(batch))]
        embeds = embeddings.embed_documents(texts)
        metadatas = [{"page": c.metadata.get("page", 0), "source": "CPT_Handbook"} for c in batch]
        collection.add(documents=texts, embeddings=embeds, ids=ids, metadatas=metadatas)
        print(f"  บันทึก chunks {i+1}–{min(i+batch_size, len(chunks))}/{len(chunks)}")

    print("✅ โหลด playbook เข้า ChromaDB เรียบร้อยแล้ว")

if __name__ == "__main__":
    load_playbook()