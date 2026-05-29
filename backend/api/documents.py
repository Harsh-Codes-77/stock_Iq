from fastapi import APIRouter

router = APIRouter()

@router.get("/documents")
async def list_documents():
    return {"documents": []}
