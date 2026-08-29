// const path = require('path');
// require('dotenv').config({ path: path.join(__dirname, 'config', '.env') });

// const app = require('./app');
// const { connectDatabase } = require('./config/db.config');

// const PORT = Number(process.env.PORT) || 4000;

// connectDatabase()
//   .then(() => {
//     app.listen(PORT, () => {
//       console.log(`Enquiry System API running on http://127.0.0.1:${PORT}`);
//     });
//   })
//   .catch((error) => {
//     console.error('Failed to start server', error);
//     process.exit(1);
//   });
const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, 'config', '.env'),
});

const app = require('./app');

const PORT = Number(process.env.PORT) || 4000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Enquiry System API running on port ${PORT}`);
});