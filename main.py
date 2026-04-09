from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import torch
from transformers import AutoTokenizer, AutoModel
import numpy as np

app = FastAPI(title="RoBERTa Embedding Service")

# Load model and tokenizer
MODEL_NAME = "roberta-base"
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModel.from_pretrained(MODEL_NAME)

# Use GPU if available
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model.to(device)
model.eval()


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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
