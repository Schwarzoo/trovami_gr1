import sys
import json
from PIL import Image
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("clip-ViT-B-32")

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Image path mancante"}))
        sys.exit(1)

    image_path = sys.argv[1]

    try:
        image = Image.open(image_path).convert("RGB")
        embedding = model.encode(image)
        print(json.dumps({"embedding": embedding.tolist()}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()