import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
const s3 = new S3Client({
  region: 'ap-northeast-1',
});

const BUCKET_NAME = '';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export const handler = async (event) => {

  try {
    const resQiita = await axios.get('https://qiita.com/popular-items/feed');
    const parser = new XMLParser({
      ignoreAttributes: false,
    });
    const data = parser.parse(resQiita.data);
    const feed = data.feed;
    const entries = Array.isArray(feed.entry) ? feed.entry : [feed.entry];
    
    const result = {
      updated: feed.updated,
      items: entries.map((entry) => ({
        title: entry.title,
        id: entry.id,
        url: entry.link?.['@_href'],
      })),
    };

    // 2026-05-20-1700.json のような感じにしたい
    const fileName = (() => {
      const [yyyymmdd, hhiiss] = feed.updated.split('T');
      console.log(yyyymmdd, hhiiss);
      const hhii = hhiiss.replace(':','').slice(0, 4);
      return `${yyyymmdd}-${hhii}`
    })();

    
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `${fileName}.json`,
        Body: JSON.stringify(result),
        ContentType: 'application/json'
      })
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify(err.message),
    };
  }
};