from sentence_transformers import SentenceTransformer
import numpy as np

query = "ingenieur apprentissage automatique"

offers = [
    ("Senior Python Backend Developer", "APIs REST FastAPI PostgreSQL Docker Redis CI/CD"),
    ("Machine Learning Engineer",       "TensorFlow PyTorch scikit-learn deep learning GPU"),
    ("Data Scientist",                  "modeles predictifs Python pandas sklearn statistiques"),
    ("Data Analyst Python SQL",         "analyse metier dashboards pandas Power BI"),
    ("DevOps Engineer",                 "Kubernetes Docker CI/CD infrastructure cloud"),
    ("Frontend Developer React",        "React TypeScript JavaScript UI/UX"),
]

for model_name in ["all-MiniLM-L6-v2", "paraphrase-multilingual-MiniLM-L12-v2"]:
    print(f"\n{'='*60}")
    print(f"Model: {model_name}")
    print(f"Query: \"{query}\"")
    print("-" * 60)

    model = SentenceTransformer(model_name)
    q_vec = model.encode(query, normalize_embeddings=True)

    scores = []
    for title, desc in offers:
        o_vec = model.encode(title + " " + desc, normalize_embeddings=True)
        cosine = float(np.dot(q_vec, o_vec))
        scores.append((cosine, title))

    for score, title in sorted(scores, reverse=True):
        bar = "#" * int(score * 40)
        print(f"{score:.4f}  {bar:<40}  {title}")
