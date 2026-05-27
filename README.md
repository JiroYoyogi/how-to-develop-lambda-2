# 前提

- AWS CLI

https://docs.aws.amazon.com/ja_jp/cli/latest/userguide/getting-started-install.html

- AWSクレデンシャルの設定

下記コマンドでS3バケットのリストが表示されればOK

```
aws s3 ls
```

参考：[AWS CLIとは？メリット・インストール手順・基本的な使い方](https://business.ntt-east.co.jp/content/cloudsolution/ih_column-93.html)

- Node.js

ハンズオンではv24.15.0

# ローカルで書いたコードをアップロードする

## マネコンでコードを書くのは辛い

- 関数名：`get-qiita-trends`
- ランタイム：`Node.js 24.x`

## ローカルでコードを試しながら開発したい

- invoke.mjs

```js
import { handler } from './index.mjs';

const event = {};

const result = await handler(event);
console.log(result);
// console.log(JSON.parse(result.body));
```

- 下記コマンドで実行

```
node invoke.mjs
```

## 関数実行用のコマンドをscriptsに追加

- package.json

```json
{
  "name": "lambda-todo-handson",
  "version": "1.0.0",
  "description": "",
  "main": "invoke.mjs",
  "scripts": {
    "dev": "node invoke.mjs",
    "zip": "zip function.zip index.mjs"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type":"module"
}
```

## ZIPしてLambdaをアップデートする

```
npm run zip
```

# Node.jsライブラリを使いたい

## ライブラリインストール

```
npm i axios fast-xml-parser
```

## 人気記事を取得

```js
import axios from 'axios';

export const handler = async (event) => {

  try {
    const resQiita = await axios.get('https://qiita.com/popular-items/feed');
    console.log(resQiita);
    return {
      statusCode: 200,
      body: JSON.stringify('Successed!'),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify(err.message),
    };
  }
};
```

## 欲しい情報のみに絞る

### 1. XML → JSON

```js
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';

export const handler = async (event) => {

  try {
    const resQiita = await axios.get('https://qiita.com/popular-items/feed');
    const parser = new XMLParser({
      ignoreAttributes: false,
    });
    const data = parser.parse(resQiita.data);
    console.log(data);
    return {
      statusCode: 200,
      body: JSON.stringify('Successed!'),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify(err.message),
    };
  }
};
```

### 2. 欲しい情報のみ抽出

a. どの属性を取得するか？

```js
    const data = parser.parse(resQiita.data);
    const feed = data.feed;
    const entries = Array.isArray(feed.entry) ? feed.entry : [feed.entry];
    console.log(entries);
```

b. 必要な情報のみ抽出して return する

```js
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';

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

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify(err.message),
    };
  }
};
```

## ZIPしてLambdaをアップデートする

- package.json

node_modules配下もZIPに詰める

```
"zip": "zip -r function.zip index.mjs node_modules"
```

- コマンド

```
npm run zip
```

## 関数URLを発行する

- ブラウザで直接リクエスト
- JSからリクエスト

`index.html`を下記コードで作成する。CORSブロックされることを確認

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
</head>
<body>
  <script>
    (async () => {
      const API_URL = ""
      const res = await fetch(API_URL);
      console.log(await res.json());
    })();
  </script>
</body>
</html>
```

- レスポンスにheaderを追加

```js
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};
```

↑のコードを追加した上でレスポンスにヘッダーを追加

```js
    return {
      statusCode: 200,
      headers,
      body,
    };
```

# AWSサービスを使いたい

## S3バケットを作成

バケット名：`qiita-ternds-{名前とか}`

## ライブラリをインストール

```
npm i @aws-sdk/client-s3
```

参考：https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/command/PutObjectCommand/

## コードを変更

### ライブラリ読み込み

```js
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
const s3 = new S3Client();
```

### オブジェクト名（ファイル名）を作成する

```js
    // 2026-05-20-1700.json のような感じにしたい
    const fileName = (() => {
      const [yyyymmdd, hhiiss] = feed.updated.split('T');
      console.log(yyyymmdd, hhiiss);
      const hhii = hhiiss.replace(':','').slice(0, 4);
      return `${yyyymmdd}-${hhii}`
    })();
    console.log(fileName);
```

### S3にJSONを保存する

バケット名を定義

```js
const BUCKET_NAME = '';
```

JSONをバケットに保存

```js
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `${fileName}.json`,
        Body: JSON.stringify(result),
        ContentType: 'application/json'
      })
    );
```

## ZIPしてLambdaをアップデートする

### コマンド

```
npm run zip
```

### S3でアップロードを試してみる

バケット名：`my-lambda-source-{名前とか}`

### IAMポリシーを追加する

```
AmazonS3FullAccess
```

# 次回

- APIGW連携
- APIGW連携・パスパラメーター
- APIGW連携・リクエストボディ
- EventBridgeで定期実行
