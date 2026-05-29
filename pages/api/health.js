const BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

export default async function handler(req, res) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/health`);
    if (!response.ok) {
      return res.status(response.status).json({ status: 'error', detail: 'Backend health check failed' });
    }
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Health proxy error:', error);
    return res.status(503).json({ status: 'error', detail: 'Backend unavailable', message: error.message });
  }
}
