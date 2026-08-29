import app from './app.js';
import { connectDB } from './config/db.js';
import { connectElasticsearch } from './config/elasticsearch.js';

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  try {
    // Connect to database
    await connectDB();

    // Connect to Elasticsearch
    await connectElasticsearch();

    // Start Express HTTP Server
    app.listen(Number(PORT), "0.0.0.0", () => {
      console.log(`=========================================`);
      console.log(`REACHINBOX EXPRESS SERVER IS RUNNING`);
      console.log(`Port: ${PORT}`);
      console.log(`Bull Board: http://localhost:${PORT}/admin/queues`);
      console.log(`=========================================`);
    });
  } catch (error) {
    console.error('Bootstrap failure:', error);
    process.exit(1);
  }
}

bootstrap();