import { Client } from '@elastic/elasticsearch';

const esUrl = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
const apiKey = process.env.ELASTICSEARCH_API_KEY;

export const esClient = new Client({
  node: esUrl,
  ...(apiKey ? {
    auth: {
      apiKey,
    },
  } : {}),
});

export async function connectElasticsearch() {
  try {
    const health = await esClient.cluster.health({});
    console.log(`Successfully connected to Elasticsearch. Cluster status: ${health.status}`);

    // Check/create emails index
    const indexExists = await esClient.indices.exists({ index: 'emails' });
    if (!indexExists) {
      await esClient.indices.create({
        index: 'emails',
        body: {
          mappings: {
            properties: {
              emailId: { type: 'keyword' },
              userId: { type: 'keyword' },
              sender: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              recipient: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              subject: { type: 'text' },
              body: { type: 'text' },
              status: { type: 'keyword' },
              scheduledAt: { type: 'date' },
              sentAt: { type: 'date' },
            },
          },
        },
      });
      console.log("Elasticsearch 'emails' index created successfully.");
    }
  } catch (error) {
    console.warn('Elasticsearch is not running or failed to connect. Searching might fail. Error:', error);
  }
}
