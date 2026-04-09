import requests
import json

BASE_URL = "http://localhost:8000"

# Test single embedding
def test_single_embed():
    text = "This is a test sentence for RoBERTa embeddings"
    response = requests.post(f"{BASE_URL}/embed", json={"text": text})
    result = response.json()
    print(f"Single embedding shape: {result['shape']}")
    print(f"First 5 values: {result['embedding'][:5]}")

# Test batch embedding
def test_batch_embed():
    texts = [
        "NoSwipeChat is a messaging application",
        "RoBERTa is a masked language model",
        "Embeddings capture semantic meaning"
    ]
    response = requests.post(f"{BASE_URL}/embed-batch", json={"texts": texts})
    result = response.json()
    print(f"\nBatch embeddings shape: {result['shape']}")
    print(f"Number of embeddings: {len(result['embeddings'])}")

# Test health check
def test_health():
    response = requests.get(f"{BASE_URL}/health")
    print(f"\nHealth check: {response.json()}")

if __name__ == "__main__":
    test_health()
    test_single_embed()
    test_batch_embed()
