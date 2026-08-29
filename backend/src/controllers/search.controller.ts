import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { esClient } from '../config/elasticsearch.js';
import { prisma } from '../config/db.js';

export async function searchEmails(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const q = (req.query.q as string || '').trim();

  if (!q) {
    return res.json({ emails: [] });
  }

  try {
    console.log(`[Search] Searching Elasticsearch for query: "${q}" (User: ${userId})`);

    const esResponse = await esClient.search({
      index: 'emails',
      body: {
        query: {
          bool: {
            must: [
              { term: { userId: userId } }
            ],
            must_not: [], // empty placeholder
            should: [
              { match: { recipient: { query: q, operator: 'or', fuzziness: 'AUTO' } } },
              { match: { subject: { query: q, operator: 'or', fuzziness: 'AUTO' } } },
              { match: { body: { query: q, operator: 'or', fuzziness: 'AUTO' } } }
            ],
            minimum_should_match: 1
          }
        }
      }
    });

    const hits = esResponse.hits.hits;
    const emails = hits.map((hit: any) => ({
      id: hit._source.emailId,
      userId: hit._source.userId,
      recipient: hit._source.recipient,
      subject: hit._source.subject,
      body: hit._source.body,
      status: hit._source.status,
      scheduledAt: hit._source.scheduledAt,
      sentAt: hit._source.sentAt || null,
      sender: {
        email: hit._source.sender,
        name: hit._source.sender.split('@')[0], // Fallback name
      }
    }));

    return res.json({ source: 'elasticsearch', emails });
  } catch (error: any) {
    console.warn('[Search] Elasticsearch query failed or offline. Falling back to MySQL. Error:', error.message || error);

    // Robust Fallback: Query MySQL directly if Elasticsearch is unavailable or down.
    try {
      const emails = await prisma.scheduledEmail.findMany({
        where: {
          userId,
          OR: [
            { recipient: { contains: q } },
            { subject: { contains: q } },
            { body: { contains: q } }
          ]
        },
        include: { sender: true },
        orderBy: { scheduledAt: 'desc' },
      });

      return res.json({ source: 'mysql_fallback', emails });
    } catch (dbError: any) {
      console.error('[Search] MySQL fallback query failed:', dbError);
      return res.status(500).json({ error: 'Search failed' });
    }
  }
}
