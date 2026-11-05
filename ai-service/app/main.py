from fastapi import FastAPI

app = FastAPI(title="Fashion AI Service")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
