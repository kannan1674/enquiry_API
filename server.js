import './config/loadEnv.js';
import app from './app.js';
import { connectDatabase } from './config/db.config.js';

const PORT = Number(process.env.PORT) || 4000;

connectDatabase()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Enquiry System API running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start server', error);
    process.exit(1);
  });
