# Cognito IDプロバイダ-Postmanアダプタ

## はじめに

- 認証機能実装でCognito IDプロバイ使を使っているWEB APIを、Postmanで動作確認するときに役立つアダプタ

## 経緯など

- PostmanでWEB APIの動作確認時にCognitoのトークンを取得して認証に使いたい時がある
- Pre-request ScriptからHTTPリクエストでCognitoのトークン取得する前提でアダプタを用意しようと思った
  - node.jsで動くシンプルなやつ

## 実行環境

- node.js 18以上

## 使い方

1. サーバを起動しておく ( npm install -> npm run start )
2. Postmanと繋ぐ ( Pre-request Scriptに設定 )

### 1. サーバを起動しておく

- コマンド実行

```
npm install
npm run start
```

- 動作確認

`5963ポートでサーバが起動していること(200応答が返ってくること)を確認`

```
$ curl --head -XGET "http://localhost:5963?test_username=sutekinausername&test_password=fujikawaA5&aws_region=ap-northeast-1&cognito_user_pool_id=ap-northeast-1_fugaVAyI&cognito_client_id=hogediuh5k2m6nfmat3iordvodm"

HTTP/1.1 200 OK
Content-Type: application/json
Date: Sun, 27 Aug 2023 02:03:04 GMT
Connection: keep-alive
Keep-Alive: timeout=5
```

### 2. Postmanと繋ぐ

- Pre-request Scriptに設定
- This script will execute before every request in this collection. Learn more about 

```javascript
const testUsername = pm.environment.get("test_username");
const testPassword = pm.environment.get("test_password");
const awsRegion = pm.environment.get("aws_region");
const cognitoUserPoolId = pm.environment.get("cognito_user_pool_id");
const cognitoClientId = pm.environment.get("cognito_client_id");

pm.sendRequest(
    `http://localhost:5963?test_username=${encodeURIComponent(testUsername)}&test_password=${encodeURIComponent(testPassword)}&aws_region=${awsRegion}&cognito_user_pool_id=${cognitoUserPoolId}&cognito_client_id=${cognitoClientId}`,
    function (err, response) {
        pm.environment.set("bearerToken", response.json()["COGNITO_ID_TOKEN"]);
    }
);

```

## 備考

- Postmanと繋ぐ場合Postmanのログインアカウントが必要です。またpostmanのワークスペースに登録したAPI定義やテストに使うパラメータなどはオンラインでPostmanのサーバにバックアップされます
  - セキュリティに厳しい環境にある場合まずは大人の人に相談しましょう
    - https://github.com/postmanlabs/postman-app-support/


