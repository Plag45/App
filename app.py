import os
import sqlite3
import fitz  # PyMuPDF
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from openai import OpenAI

# === Config ===
OPENAI_API_KEY = ""  
BASE_DB_DIR = "Cautare_Fisier"
PDF_FOLDER = os.path.join(BASE_DB_DIR, "pdf_data_toc_missing")
PREVIEW_FOLDER = os.path.join("public", "previews")
FEEDBACK_DB_FILE = os.path.join(BASE_DB_DIR, "feedback.db")

embedding_model = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
client = OpenAI(api_key=OPENAI_API_KEY)

os.makedirs(BASE_DB_DIR, exist_ok=True)
os.makedirs(PREVIEW_FOLDER, exist_ok=True)

# === Setup cache DB ===
conn = sqlite3.connect(FEEDBACK_DB_FILE, check_same_thread=False)
cursor = conn.cursor()
cursor.execute("""
    CREATE TABLE IF NOT EXISTS qa_pairs (
        question TEXT PRIMARY KEY,
        answer TEXT
    )
""")
conn.commit()

# === Flask ===
app = Flask(__name__)
CORS(app)

# === Helper functions ===
def list_chroma_dbs(base_path):
    return [
        name for name in os.listdir(base_path)
        if os.path.isdir(os.path.join(base_path, name))
    ]

def semantic_search(db, query, k=20):
    return db.similarity_search(query, k=k)

def ask_openai(question, docs):
    if not docs:
        return "No relevant documents found in the database."
    context = "\n".join([doc.page_content for doc in docs])
    prompt = f"""
Context:
{context}

Question: {question}
Answer:
"""
    response = client.chat.completions.create(
        model="gpt-4-turbo",
        messages=[
            {"role": "system", "content": "You are an expert assistant trained to extract and summarize regulatory and financial information from regional interchange manuals. Always base your answers strictly on the context provided."},
            {"role": "user", "content": prompt}
        ]
    )
    return response.choices[0].message.content.strip()

def generate_image_from_pdf(pdf_name, page_number):
    pdf_path = os.path.join(PDF_FOLDER, pdf_name)
    if not os.path.exists(pdf_path):
        print(f"[ERROR] PDF not found: {pdf_path}")
        return None

    try:
        doc = fitz.open(pdf_path)
        if page_number < 1 or page_number > len(doc):
            print(f"[ERROR] Page number {page_number} out of bounds.")
            return None

        page = doc[page_number - 1]
        pix = page.get_pixmap(dpi=150)
        image_name = pdf_name.replace(".pdf", f"_p{page_number}.png").replace("\\", "_").replace("/", "_")
        image_path = os.path.join(PREVIEW_FOLDER, image_name)
        pix.save(image_path)
        return image_name
    except Exception as e:
        print(f"[ERROR] Failed to generate image with fitz: {e}")
        return None

# === Endpoints ===

@app.route("/databases", methods=["GET"])
def get_databases():
    dbs = list_chroma_dbs(BASE_DB_DIR)
    return jsonify(dbs)

@app.route("/query", methods=["POST"])
def query_database():
    data = request.get_json()
    question = data.get("query")
    db_name = data.get("database")

    if not db_name:
        return jsonify({"answer": "No database selected."}), 400

    db_path = os.path.join(BASE_DB_DIR, db_name)
    if not os.path.exists(db_path):
        return jsonify({"answer": "Database not found."}), 404

    db = Chroma(
        embedding_function=embedding_model,
        persist_directory=db_path
    )

    docs = semantic_search(db, question)
    metadata = docs[0].metadata if docs else {}

    raw_pdf_path = metadata.get("source", "")
    clean_pdf = os.path.basename(raw_pdf_path.replace("pdf_data_toc_missing\\", "").replace("pdf_data_toc_missing/", ""))
    page = int(metadata.get("page_label", metadata.get("page", 1)))

    answer = ask_openai(question, docs)

    cursor.execute("SELECT answer FROM qa_pairs WHERE question = ?", (question,))
    if not cursor.fetchone():
        cursor.execute("INSERT OR REPLACE INTO qa_pairs (question, answer) VALUES (?, ?)", (question, answer))
        conn.commit()

    image_name = generate_image_from_pdf(clean_pdf, page)

    return jsonify({
        "answer": answer,
        "source": metadata,
        "image": image_name
    })

@app.route("/previews/<path:filename>", methods=["GET"])
def serve_preview(filename):
    return send_from_directory(PREVIEW_FOLDER, filename)

# === Start ===
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
