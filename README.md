# 事前インストール

- AWS CLI

https://docs.aws.amazon.com/ja_jp/cli/latest/userguide/getting-started-install.html

- AWSクレデンシャルの設定

動画と同じ環境で進めるため、リージョンは 東京（ap-northeast-1） に設定してください。 下記コマンドを実行し、エラーが出ずにS3バケットのリスト（または何も出ずにプロンプトが戻る状態）が表示されれば設定OKです。

```
aws s3 ls
```

参考：[AWS CLIとは？メリット・インストール手順・基本的な使い方](https://business.ntt-east.co.jp/content/cloudsolution/ih_column-93.html)

- Node.js

ハンズオンではv24.15.0

# 前回のあらすじ

関数URLにリクエストするとQiitaのトレンドを取得。欲しい情報のみ抽出したJSONをユーザーに返却。また、S3にJSONを保存する

## 補足

### zipの方法について

MacかWinでzipするコマンドが異なる

### zipアップロード後のログについて

「モニタリング」タブ → 「CloudWatchログを表示」→ 「ログストリーム」

# APIGatewayとの連携

## APIを作成

- APIタイプ：`HTTP API`
- API名：`lambda-handson-api`

### APIのルート作成

- メソッド：`GET`
- ルート：`/trends`

### 統合をアタッチ

1. 「Routes」メニューで「/trends」の「GET」を選択

2. 「統合をアタッチする」をクリック

3. 「統合ターゲット」でLambda関数を選択

4. 「get-qiita-trends」を選択し「作成」

### APIリクエストをブラウザでテスト

```
{APIのURL}/trends
```

例：

```
https://abcdefg.execute-api.ap-northeast-1.amazonaws.com/trends
```

# APIのパスパラメーターを扱う

最新のものではなくS3に保存した過去のトレンドのデータを日時指定して取得したい

```
/trends/{datetime}
```

2026年5月30日の5時時点のトレンドを取得したい場合

```
/trends/2026-05-30-0500
```

## APIから渡ってくるイベント（ペイロード）

https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html

## コードを変更

- invoke.mjs

上記からよく使うものを抽出。ここで使うのは`pathParameters`のみ

```js
const event = {
  "rawPath": "/my/path",
  // ?parameter1=hoge
  queryStringParameters: {
    parameter1: "value1,value2",
    parameter2: "value",
  },
  // リクエストボディ（フォームなど）
  body: "Hello from Lambda",
  // /trends/{datetime}
  pathParameters: {
    datetime: '2099-12-31-0500'
  },
};
```

- index.mjs

`event`の中身を確認

```
  console.log(event);
  return;
```

### パスパラメーターがある場合はS3からJSONを取得する

ライブラリの追加読み込み

```js
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
```

S3からJSONを取得する

```js
  const specificDate = event.pathParameters?.datetime;
  // 関数URLの場合は、event.rawPath?.split('/trends/')[1]; で取得出来る

  if (specificDate) {
    try {
      const s3GetRes = await s3.send(
        new GetObjectCommand({
          Bucket: 'qiita-popular-ranking',
          Key: `${specificDate}.json`,
        })
      );

      const s3ResBody = await s3GetRes.Body.transformToString();

      return {
        statusCode: 200,
        headers,
        body: s3ResBody,
      };

    } catch (err) {
      console.log(err.message);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify(err.message),
      };
    }
  }
```

### サンプルJSON

- 2099-12-31-1700.json

※本物のデータではなくあくまでサンプルです。

```json
{
  "updated": "2099-12-31T17:00:00+09:00",
  "items": [
    {
      "title": "AWS Lambdaで簡単なAPIを作ってみた話",
      "id": "tag:qiita.com,2005:PublicArticle/1234567",
      "url": "https://qiita.com/sample-user/items/abcdef1234567890"
    },
    {
      "title": "初心者向け！JavaScriptでXMLをJSONに変換する方法",
      "id": "tag:qiita.com,2005:PublicArticle/2345678",
      "url": "https://qiita.com/dev-beginner/items/1234abcd5678efgh"
    },
    {
      "title": "Node.jsからAWS SDKを使ってS3にJSONを保存する",
      "id": "tag:qiita.com,2005:PublicArticle/3456789",
      "url": "https://qiita.com/cloud-engineer/items/zyxw9876vuts5432"
    }
  ]
}
```

### ZIPしてLambdaをアップデートする

```
npm run zip
```

💡 Windows環境で npm run zip-win が失敗する場合

コマンドが正しく動作しない場合は、動画の解説通り、エクスプローラー上で対象のindex.mjsとnode_modulesフォルダを同時に選択し、右クリックから「ZIPファイルに圧縮（または 送る ＞ 圧縮フォルダ）」を行ってください。


## APIパスを追加する

- メソッド：`GET`
- ルート：`/trends/{datetime}`

### 統合をアタッチ

1. 「Routes」メニューで「/trends/{datetime}」の「GET」を選択

2. 「統合をアタッチする」をクリック

3. 「統合ターゲット」でLambda関数を選択

4. 「get-qiita-trends」を選択し「作成」

### APIリクエストをブラウザでテスト

```
https://abcdefg.execute-api.ap-northeast-1.amazonaws.com/trends/2099-12-31-1700
```

# リクエストボディを扱う（「いいね」をGET・POST）

## DynamoDBの作成

テーブルの作成

- テーブル名：`lambda-handson-likes`
- パーティションキー：`id`

インデックスの作成

- インデックス名：`articleId-index`
- パーティションキー：`articleId`

## コードをDL

[こちらのリポジトリ](https://abcdefg.execute-api.ap-northeast-1.amazonaws.com/trends/2099-12-31-1700)よりコードをDL

## eventの中身を確認 & 実装の方針

GETとPOSTの関数を分けて作るとハンズオン上では手間なので、1つの関数を共有。if文でGETとPOSTの処理を分ける

## 「いいね」をPOST

### DynamoDBを操作するライブラリをインストール

```
npm i @aws-sdk/client-dynamodb
```

### コードを変更

```js
import { randomUUID } from "node:crypto";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

const dynamoDb = new DynamoDBClient();

const TABLE_NAME = "lambda-handson-likes";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

export const handler = async (event) => {
  try {
    // HTTP API => event.requestContext?.http?.method
    // REST API => event.httpMethod
    const httpMethod = event.requestContext?.http?.method ?? event.httpMethod;
    const articleId = event.pathParameters?.articleId;

    console.log(httpMethod, articleId);
    
    if (!articleId) {
      throw new Error("articleId is required");
    }

    const eventBody = event.body ? JSON.parse(event.body) : {};
    const userName = eventBody.userName ?? "";

    if (!userName) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          message: "userName is required",
        }),
      };
    }

    const commandPut = new PutItemCommand({
      TableName: TABLE_NAME,
      Item: {
        id: {
          S: randomUUID(),
        },
        articleId: {
          S: articleId,
        },
        userName: {
          S: userName,
        },
        createdAt: {
          S: new Date().toISOString(),
        },
      },
    });

    await dynamoDb.send(commandPut);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'success',
        articleId,
        userName,
      }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: err.message,
      }),
    };
  }
};
```

## 「いいね」をGET

### コードを変更

差分：

- QueryCommandの読み込み
- `if (httpMethod === "GET")`の処理追加

```js
import { randomUUID } from "node:crypto";
import {
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";

const dynamoDb = new DynamoDBClient();

const TABLE_NAME = "lambda-handson-likes";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

export const handler = async (event) => {
  try {
    // HTTP API => event.requestContext?.http?.method
    // REST API => event.httpMethod
    const httpMethod =
      event.requestContext?.http?.method ?? event.httpMethod;

    const articleId = event.pathParameters?.articleId;

    console.log(httpMethod, articleId);

    if (!articleId) {
      throw new Error("articleId is required");
    }

    // GET /likes/{articleId}
    if (httpMethod === "GET") {
      const commandQuery = new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "articleId-index",
        KeyConditionExpression: "articleId = :articleId",
        ExpressionAttributeValues: {
          ":articleId": {
            S: articleId,
          },
        },
      });

      const response = await dynamoDb.send(commandQuery);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          articleId,
          items: response.Items ?? [],
        }),
      };
    }

    // POST /likes/{articleId}
    const eventBody = event.body ? JSON.parse(event.body) : {};
    const userName = eventBody.userName ?? "";

    if (!userName) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          message: "userName is required",
        }),
      };
    }

    const commandPut = new PutItemCommand({
      TableName: TABLE_NAME,
      Item: {
        id: {
          S: randomUUID(),
        },
        articleId: {
          S: articleId,
        },
        userName: {
          S: userName,
        },
        createdAt: {
          S: new Date().toISOString(),
        },
      },
    });

    await dynamoDb.send(commandPut);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: "success",
        articleId,
        userName,
      }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: err.message,
      }),
    };
  }
};
```

## DynamoDB JSON → JSON

### ライブラリインストール

```
npm i @aws-sdk/lib-dynamodb
```

### コードを変更

```js
import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient();
const dynamoDb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "lambda-handson-likes";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

export const handler = async (event) => {
  try {
    const httpMethod =
      event.requestContext?.http?.method ?? event.httpMethod;

    const articleId = event.pathParameters?.articleId;

    console.log(httpMethod, articleId);

    if (!articleId) {
      throw new Error("articleId is required");
    }

    // GET /likes/{articleId}
    if (httpMethod === "GET") {
      const commandQuery = new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: "articleId-index",
        KeyConditionExpression: "articleId = :articleId",
        ExpressionAttributeValues: {
          ":articleId": articleId,
        },
      });

      const response = await dynamoDb.send(commandQuery);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          articleId,
          items: response.Items ?? []
        }),
      };
    }

    // POST /likes/{articleId}
    const eventBody = event.body ? JSON.parse(event.body) : {};
    const userName = eventBody.userName ?? "";

    if (!userName) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          message: "userName is required",
        }),
      };
    }

    const commandPut = new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        id: randomUUID(),
        articleId,
        userName,
        createdAt: new Date().toISOString(),
      },
    });

    await dynamoDb.send(commandPut);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: "success",
        articleId,
        userName,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: err.message,
      }),
    };
  }
};
```

### LambdaをZIPする

```
npm run zip
```

### Lambda関数を作成する

- 関数名：`lambda-handson-likes`
- ランタイム：`Node.js 24.x`

## APIパスを追加する

### 「いいね」をGET

- メソッド：`GET`
- ルート：`/likes/{articleId}`

### 「いいね」をPOST

- メソッド：`POST`
- ルート：`/likes/{articleId}`

### 統合をアタッチ

1. 「Routes」メニューで「/likes/{articleId}」の「GET」を選択

2. 「統合をアタッチする」をクリック

3. 「統合ターゲット」でLambda関数を選択

4. 「lambda-handson-likes」を選択し「作成」

5. 「POST」も同様に実行

## APIリクエストをブラウザでテスト

Chromeの拡張機能「Boomerang」でテスト（※飛ばしてもOK！）

- URL

```
https://abcdefg.execute-api.ap-northeast-1.amazonaws.com/likes/123
```

- リクエストボディ

```json
{      
  "userName": "代々木二郎"
}
```

### IAMポリシーを追加

```json
{
	"Version": "2012-10-17",
	"Statement": [
		{
		  "Effect": "Allow",
		  "Action": [
		    "dynamodb:PutItem",
		    "dynamodb:Query"
		  ],
		  "Resource": [
		    "arn:aws:dynamodb:ap-northeast-1:アカウントID:table/lambda-handson-likes",
		    "arn:aws:dynamodb:ap-northeast-1:アカウントID:table/lambda-handson-likes/index/articleId-index"
		  ]
		}
	]
}
```

ポリシー名

```
dynamodb-policy
```

## WEBサイトからリクエスト

```html
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <title></title>
    <style>
      body {
        line-height: 1.8;
        max-width: 720px;
        margin: 40px auto;
        font-family: sans-serif;
      }

      h1 {
        font-size: 28px;
        border-bottom: 1px solid #ddd;
        padding-bottom: 12px;
      }

      .like-button {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-top: 24px;
        padding: 10px 16px;
        border: 1px solid #ddd;
        border-radius: 999px;
        background: #fff;
        cursor: pointer;
        transition: background 0.2s;
      }

      .like-button:hover {
        background: #f7f7f7;
      }

      .like-button svg {
        width: 20px;
        height: 20px;
        fill: #e0245e;
      }

      .like-count {
        font-size: 14px;
      }
    </style>
  </head>
  <body>
    <article>
      <h1>タイトルタイトルタイトル</h1>

      <p>
        テキストテキストテキストテキストテキストテキストテキストテキストテキスト
      </p>
      <p>
        テキストテキストテキストテキストテキストテキストテキストテキストテキスト
      </p>
      <p>
        テキストテキストテキストテキストテキストテキストテキストテキストテキスト
      </p>

      <button id="js-like-button" class="like-button">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5
               2 5.42 4.42 3 7.5 3
               c1.74 0 3.41 0.81 4.5 2.09
               C13.09 3.81 14.76 3 16.5 3
               19.58 3 22 5.42 22 8.5
               c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          />
        </svg>
        <span class="like-count"
          >いいね！ <span id="js-like-count">0</span></span
        >
      </button>
    </article>

    <script>
      const btnLike = document.getElementById("js-like-button");
      const countLike = document.getElementById("js-like-count");

      const articleId = "123";
      // const API_BASE_URL = "https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com";
      const API_BASE_URL =
        "https://ezvee5xvy5.execute-api.ap-northeast-1.amazonaws.com";

      window.onload = async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/likes/${articleId}`);

          const data = await response.json();
          const items = data.items ?? [];

          countLike.innerText = items.length;
        } catch (err) {
          console.error(err);
        }
      };

      btnLike.addEventListener("click", async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/likes/${articleId}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              userName: "代々木二郎",
            }),
          });

          if (!response.ok) {
            throw new Error("failed");
          }

          countLike.innerText = Number(countLike.innerText) + 1;
        } catch (err) {
          console.error(err);
          alert("いいねの送信に失敗しました");
        }
      });
    </script>
  </body>
</html>

```

### POSTのCORS対策

プリフライトリクエストが通るようにAPIGatewayを設定

- Access-Control-Allow-Origin：`*`
- Access-Control-Allow-Methods：`GET, POST, OPTIONS`
- Access-Control-Allow-Headers：`content-type`

# EventBridgeで定期実行

Qiitaのトレンド記事を定期的に取得する設定