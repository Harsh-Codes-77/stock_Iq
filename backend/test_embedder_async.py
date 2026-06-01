import os
import unittest
from unittest.mock import AsyncMock, patch

os.environ.setdefault("DATABASE_URL", "postgresql://localhost:5432/test")
os.environ.setdefault("GEMINI_API_KEY", "test-key")

from backend.engines import embedder


class EmbedderAsyncTests(unittest.IsolatedAsyncioTestCase):
    async def test_embed_text_uses_to_thread(self):
        mock_result = {"embedding": [0.1, 0.2]}

        with patch.object(embedder.asyncio, "to_thread", new=AsyncMock(return_value=mock_result)) as mock_to_thread:
            embedding = await embedder.embed_text("sample")

        self.assertEqual(embedding, [0.1, 0.2])
        mock_to_thread.assert_awaited_once_with(
            embedder.genai.embed_content,
            model="models/text-embedding-004",
            content="sample",
            task_type="retrieval_document",
        )

    async def test_embed_text_query_uses_to_thread(self):
        mock_result = {"embedding": [0.3, 0.4]}

        with patch.object(embedder.asyncio, "to_thread", new=AsyncMock(return_value=mock_result)) as mock_to_thread:
            embedding = await embedder.embed_text_query("sample query")

        self.assertEqual(embedding, [0.3, 0.4])
        mock_to_thread.assert_awaited_once_with(
            embedder.genai.embed_content,
            model="models/text-embedding-004",
            content="sample query",
            task_type="retrieval_query",
        )


if __name__ == "__main__":
    unittest.main()
