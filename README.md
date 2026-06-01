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

概要：

関数URLにリクエストするとQiitaのトレンドを取得。欲しい情報のみ抽出したJSONをユーザーに返却。また、S3にJSONを保存する

Lambda：

- 関数名：`get-qiita-trends`
- ランタイム：`Node.js24.x`
- 「設定」→「アクセス権限」→「ロール名」→「AmazonS3FullAccess」許可を追加

S3：

- バケット名：`qiita-trends-{名前とか}`

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
https://abcdefg.execute-api.ap-northeast-1.amazonaws.com/trends/2026-05-30-0500
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
    datetime: '2099-12-31-1700'
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

# EventBridgeで定期実行

Qiitaのトレンド記事を定期的に取得する設定

## rateベース（1分毎に実行）

### スケジュールの詳細の指定

- スケジュール名：`qiita-trends-schedule`
- スケジュールグループ：`default`
- スケジュールのパターン：`定期的なスケジュール`
- スケジュールの種類：`rate ベースのスケジュール`
- rate 式：`1 minuites`
- フレックスタイムウィンドウ：`オフ`

### ターゲットの選択

- テンプレート化されたターゲット：`AWS Lambda Invoke`
- Invoke Lambda 関数：`get-qiita-trends`

## cronベース（定時実行）

```
0 6,18 * * ? *
```