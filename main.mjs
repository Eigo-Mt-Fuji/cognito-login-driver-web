import http from 'http'

import url from 'url';

import { createHmac } from "crypto" ;
import {
    CognitoIdentityProviderClient,
    InitiateAuthCommand,
    RespondToAuthChallengeCommand } from "@aws-sdk/client-cognito-identity-provider";
import {
    default as AuthenticationHelperWrapper
} from "amazon-cognito-identity-js/lib/AuthenticationHelper.js";
import {
    default as BigIntegerWrapper
} from "amazon-cognito-identity-js/lib/BigInteger.js";
import {
    default as DateHelperWrapper
} from "amazon-cognito-identity-js/lib/DateHelper.js";

const port = 5963;
const awsRegion = process.env.AWS_REGION;
const clientId = process.env.COGNITO_WEB_CLIENT_ID;
const userPoolId = process.env.COGNITO_USER_POOL_ID;
const username = process.env.TEST_USERNAME;
const password = process.env.TEST_PASSWORD;

const AuthenticationHelper = AuthenticationHelperWrapper.default;
const BigInteger = BigIntegerWrapper.default;
const DateHelper = DateHelperWrapper.default;

const calculateSRP_A = async (userPoolId) => {

    const userPoolName = userPoolId.split('_')[1];
    const authenticationHelper = new AuthenticationHelper(userPoolName);
    const SRP_A = authenticationHelper.largeAValue.toString(16);

    return {SRP_A, authenticationHelper};
};

const awesomeInitiateAuth = async (client, userPoolId, clientId, username, password, SRP_A) => {
    return await client.send(new InitiateAuthCommand({
        ClientId: clientId,
        UserPoolId: userPoolId,
        AuthFlow: "USER_SRP_AUTH", // 認証フロー名
        AuthParameters: {
            USERNAME: username, // ログインするユーザの名前
            PASSWORD: password, // ログインするユーザのパスワード
            SRP_A: SRP_A,
        },
    }));
};

const awesomeResponedToInitiateAuth = async(client, userPoolId, clientId, initiateAuthResult, hkdfResult) => {
    // タイムスタンプ生成
    const dateHelper = new DateHelper();
    const dateNow = dateHelper.getNowString();

    // 署名するメッセージを作成
    const userPoolName = userPoolId.split('_')[1];
    const msg = Buffer.concat([
        Buffer.from(userPoolName, 'utf-8'),
        Buffer.from(initiateAuthResult.ChallengeParameters.USERNAME, 'utf-8'),
        Buffer.from(initiateAuthResult.ChallengeParameters.SECRET_BLOCK, 'base64'),
        Buffer.from(dateNow, 'utf-8'),
    ]);

    const signature = createHmac('sha256', hkdfResult.hkdf).update(msg).digest('base64');

    const respondAuthResult = await client.send(
        new RespondToAuthChallengeCommand({
            ClientId: clientId, // CognitoクライアントID
            UserPoolId: userPoolId, // CognitoユーザープールID
            ChallengeName: initiateAuthResult.ChallengeName,
            ChallengeResponses: {
                PASSWORD_CLAIM_SIGNATURE: signature,
                PASSWORD_CLAIM_SECRET_BLOCK: initiateAuthResult.ChallengeParameters.SECRET_BLOCK,
                TIMESTAMP: dateNow,
                USERNAME: initiateAuthResult.ChallengeParameters.USERNAME,
                Session: initiateAuthResult.Session,
            }
        })
    );
    return respondAuthResult;

};

const server = http.createServer(async (request, response) => {
    response.writeHead(200, {
      "Content-Type": "application/json"
    });
    const query = url.parse(request.url,true).query;
    const username = query["test_username"];
    const awsRegion = query["aws_region"]; 
    const clientId = query["cognito_client_id"];
    const userPoolId = query["cognito_user_pool_id"];
    const password = query["test_password"];

    const {SRP_A, authenticationHelper} = await calculateSRP_A(userPoolId);

    const client = new CognitoIdentityProviderClient({ region: awsRegion });
      const initiateAuthResult = await awesomeInitiateAuth(
      client, 
      userPoolId, 
      clientId, 
      username, 
      password,
      SRP_A
   );

   const hkdfResult = {hkdf: undefined};
   authenticationHelper.getPasswordAuthenticationKey(
    initiateAuthResult.ChallengeParameters.USERNAME,
    password,
    new BigInteger(initiateAuthResult.ChallengeParameters.SRP_B, 16),
    new BigInteger(initiateAuthResult.ChallengeParameters.SALT, 16),
    async (err, result) => {
        hkdfResult.hkdf = result;

        const respondAuthResult = await awesomeResponedToInitiateAuth(
            client, 
            userPoolId, 
            clientId, 
            initiateAuthResult, 
            hkdfResult, 
        );
        
        const {
            AccessToken, 
            IdToken, 
            RefreshToken, 
            ExpiresIn
        } = respondAuthResult.AuthenticationResult;
        
        console.log(IdToken);
        const responseMessage = JSON.stringify({"COGNITO_ID_TOKEN":IdToken});
        response.end(responseMessage);
        console.log(`Sent a response : ${responseMessage}`);
      
    },
  );
});

server.listen(port);
console.log(`The server has started and is listening on port number: ${port}`);

