import math
import os

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import torch
from transformers import AutoTokenizer, AutoModel
import numpy as np

app = FastAPI(title="RoBERTa Embedding Service")

# Load model and tokenizer from Hugging Face.
MODEL_NAME = os.getenv("HF_MODEL_NAME", "roberta-base")
HF_CACHE_DIR = os.getenv("HF_HOME")
TARGET_PERSONALITY_DIM = 73
PERSONALITY_PROJECTION_SEED = int(os.getenv("PERSONALITY_PROJECTION_SEED", "73"))

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, cache_dir=HF_CACHE_DIR)
model = AutoModel.from_pretrained(MODEL_NAME, cache_dir=HF_CACHE_DIR)

# Use GPU if available
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model.to(device)
model.eval()

_projection_rng = np.random.default_rng(PERSONALITY_PROJECTION_SEED)
_hidden_size = int(getattr(model.config, "hidden_size", 768))
_personality_projection = _projection_rng.standard_normal(
    (_hidden_size, TARGET_PERSONALITY_DIM)
).astype(np.float32)
_metric_keys = [
    "friends_count",
    "timeline_post_count",
    "connected_friends_count",
    "text_sample_count",
    "avg_text_length",
    "recent_chat_count",
]
_metric_projection = _projection_rng.standard_normal(
    (len(_metric_keys), TARGET_PERSONALITY_DIM)
).astype(np.float32)


class TextInput(BaseModel):
    text: str


class EmbeddingResponse(BaseModel):
    embedding: list
    shape: tuple


class BatchTextInput(BaseModel):
    texts: list[str]


class BatchEmbeddingResponse(BaseModel):
    embeddings: list[list]
    shape: tuple


class Personality73Input(BaseModel):
    texts: list[str] = Field(default_factory=list)
    metrics: dict[str, float] = Field(default_factory=dict)


class Personality73Response(BaseModel):
    vector73: list[float]
    vector35: list[float]
    model: str
    textSamplesUsed: int
    metricsUsed: dict[str, float]


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "ok", "model": MODEL_NAME, "device": str(device)}


@app.post("/embed", response_model=EmbeddingResponse)
async def get_embedding(input_data: TextInput):
    """
    Generate embedding for a single text.
    
    Returns the [CLS] token representation (768-dim for roberta-base).
    """
    try:
        with torch.no_grad():
            inputs = tokenizer(
                input_data.text,
                return_tensors="pt",
                padding=True,
                truncation=True,
                max_length=512
            ).to(device)
            
            outputs = model(**inputs)
            # Use [CLS] token embedding (first token)
            embedding = outputs.last_hidden_state[:, 0, :].cpu().numpy().tolist()[0]
        
        return EmbeddingResponse(
            embedding=embedding,
            shape=(1, len(embedding))
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/embed-batch", response_model=BatchEmbeddingResponse)
async def get_batch_embeddings(input_data: BatchTextInput):
    """
    Generate embeddings for multiple texts.
    
    Returns [CLS] token representations as a batch.
    """
    if not input_data.texts:
        raise HTTPException(status_code=400, detail="Empty text list")
    
    if len(input_data.texts) > 100:
        raise HTTPException(status_code=400, detail="Batch size exceeds 100")
    
    try:
        with torch.no_grad():
            inputs = tokenizer(
                input_data.texts,
                return_tensors="pt",
                padding=True,
                truncation=True,
                max_length=512
            ).to(device)
            
            outputs = model(**inputs)
            # Use [CLS] token embedding for each sample
            embeddings = outputs.last_hidden_state[:, 0, :].cpu().numpy().tolist()
        
        return BatchEmbeddingResponse(
            embeddings=embeddings,
            shape=(len(embeddings), len(embeddings[0]))
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/embed-pooled")
async def get_pooled_embedding(input_data: TextInput):
    """
    Generate mean-pooled embedding (average of all tokens).
    Alternative to [CLS]-only approach.
    """
    try:
        with torch.no_grad():
            inputs = tokenizer(
                input_data.text,
                return_tensors="pt",
                padding=True,
                truncation=True,
                max_length=512
            ).to(device)
            
            outputs = model(**inputs)
            # Mean pooling: average all token embeddings
            attention_mask = inputs['attention_mask']
            embeddings = outputs.last_hidden_state
            mask_expanded = attention_mask.unsqueeze(-1).expand(embeddings.size()).float()
            sum_embeddings = torch.sum(embeddings * mask_expanded, 1)
            sum_mask = torch.clamp(mask_expanded.sum(1), min=1e-9)
            embedding = (sum_embeddings / sum_mask).cpu().numpy().tolist()[0]
        
        return EmbeddingResponse(
            embedding=embedding,
            shape=(1, len(embedding))
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _sigmoid(values: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-values))


def _normalize_metric(metric_name: str, metric_value: float) -> float:
    value = max(0.0, float(metric_value))
    if metric_name.endswith("_count"):
        return float(np.tanh(math.log1p(value) / 4.0))
    if metric_name == "avg_text_length":
        return float(np.tanh(value / 280.0))
    return float(np.tanh(value))


def _build_vector35(vector73: np.ndarray) -> list[float]:
    edges = np.linspace(0, TARGET_PERSONALITY_DIM, 36, dtype=int)
    result = []
    for i in range(35):
        start = edges[i]
        end = edges[i + 1]
        segment = vector73[start:end] if end > start else vector73[start:start + 1]
        result.append(float(np.mean(segment)))
    return result


@app.post("/personality-73", response_model=Personality73Response)
async def build_personality_73(input_data: Personality73Input):
    """
    Generate a normalized 73-point personality vector from social text and metrics.
    """
    texts = [
        str(text).strip()[:1000]
        for text in (input_data.texts or [])
        if str(text).strip()
    ][:64]

    if not texts and not input_data.metrics:
        raise HTTPException(
            status_code=400,
            detail="Provide at least one text sample or one social metric",
        )

    try:
        if texts:
            with torch.no_grad():
                inputs = tokenizer(
                    texts,
                    return_tensors="pt",
                    padding=True,
                    truncation=True,
                    max_length=256,
                ).to(device)

                outputs = model(**inputs)
                attention_mask = inputs["attention_mask"].unsqueeze(-1).expand(
                    outputs.last_hidden_state.size()
                ).float()
                sum_embeddings = torch.sum(outputs.last_hidden_state * attention_mask, dim=1)
                sum_mask = torch.clamp(attention_mask.sum(dim=1), min=1e-9)
                pooled = (sum_embeddings / sum_mask).cpu().numpy()
                profile_embedding = np.mean(pooled, axis=0)
        else:
            profile_embedding = np.zeros((_hidden_size,), dtype=np.float32)

        base_logits = np.matmul(profile_embedding, _personality_projection) / math.sqrt(_hidden_size)

        normalized_metrics = {
            key: _normalize_metric(key, input_data.metrics.get(key, 0.0))
            for key in _metric_keys
        }
        metric_vector = np.array([normalized_metrics[key] for key in _metric_keys], dtype=np.float32)
        metric_logits = np.matmul(metric_vector, _metric_projection)

        combined_logits = base_logits + (0.35 * metric_logits)
        vector73 = _sigmoid(combined_logits).clip(0.0, 1.0)
        vector35 = _build_vector35(vector73)

        return Personality73Response(
            vector73=[float(value) for value in vector73.tolist()],
            vector35=vector35,
            model=MODEL_NAME,
            textSamplesUsed=len(texts),
            metricsUsed=normalized_metrics,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
