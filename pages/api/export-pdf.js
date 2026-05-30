const BACKEND_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { ticker } = req.query;
  if (!ticker) {
    return res.status(400).json({ error: 'Ticker parameter is required' });
  }

  try {
    const backendRes = await fetch(`${BACKEND_URL}/api/export/pdf/${ticker.toUpperCase()}`, {
      method: 'POST',
    });

    if (!backendRes.ok) {
      const errText = await backendRes.text();
      return res.status(backendRes.status).json({ error: 'Failed to generate PDF', detail: errText });
    }

    // Set headers to trigger browser download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${ticker.toUpperCase()}_StockIQ_Research_Note.pdf`);

    // Stream the binary buffer
    const arrayBuffer = await backendRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return res.status(200).send(buffer);

  } catch (error) {
    console.error('PDF export proxy error:', error);
    return res.status(503).json({ error: 'Backend unavailable', detail: error.message });
  }
}
