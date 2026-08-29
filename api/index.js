import express from 'express';

async function loadApp() {
  try {
    const { default: app } = await import('../app.js');
    return app;
  } catch (error) {
    console.error('Failed to load app', error);

    const fallback = express();
    fallback.use((req, res) => {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to start API',
      });
    });
    return fallback;
  }
}

export default await loadApp();
