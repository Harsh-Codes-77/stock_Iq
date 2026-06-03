const BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const response = await fetch(`${BACKEND_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body),
      });

      if (!response.ok) {
        const error = await response.json();
        return res.status(response.status).json(error);
      }

      const data = await response.json();
      return res.status(200).json(data);
    } catch (error) {
      console.error('FastAPI proxy POST error:', error);
      return res.status(503).json({ error: 'Backend unavailable', detail: error.message });
    }
  } else if (req.method === 'GET') {
    const { job_id } = req.query;
    if (!job_id) {
      return res.status(400).json({ error: 'job_id query parameter is required' });
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/analyze/${job_id}/status`);

      if (!response.ok) {
        const error = await response.json();
        return res.status(response.status).json(error);
      }

      const data = await response.json();
      return res.status(200).json(data);
    } catch (error) {
      console.error('FastAPI proxy GET status error:', error);
      return res.status(503).json({ error: 'Backend unavailable', detail: error.message });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
