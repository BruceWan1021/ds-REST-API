import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  TranslateClient,
  TranslateTextCommand,
} from "@aws-sdk/client-translate";

const ddbDocClient = createDynamoDocClient();
const translateClient = new TranslateClient({ region: process.env.REGION });

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const matchId = event.pathParameters?.matchId;
    const language = event.queryStringParameters?.language;

    if (!matchId || !language) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Missing matchId path parameter or language query",
        }),
      };
    }

    const key = {
      matchId: parseInt(matchId),
    };

    // 1. 获取比赛数据
    const getResult = await ddbDocClient.send(
      new GetCommand({
        TableName: process.env.TABLE_NAME,
        Key: key,
      })
    );

    const match = getResult.Item;

    if (!match || !match.description) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Match not found or missing description" }),
      };
    }

    const description = match.description;
    const existingTranslations = match.translations || {};

    // 2. 如果已有翻译，直接返回
    if (existingTranslations[language]) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          original: description,
          translated: existingTranslations[language],
          cached: true,
        }),
      };
    }

    // 3. 调用 Amazon Translate
    const translationResult = await translateClient.send(
      new TranslateTextCommand({
        Text: description,
        SourceLanguageCode: "en",
        TargetLanguageCode: language,
      })
    );

    const translated = translationResult.TranslatedText;

    // 4. 初始化 translations 字段（如果不存在）
    await ddbDocClient.send(
      new UpdateCommand({
        TableName: process.env.TABLE_NAME,
        Key: key,
        UpdateExpression: "SET #translations = if_not_exists(#translations, :emptyObj)",
        ExpressionAttributeNames: {
          "#translations": "translations",
        },
        ExpressionAttributeValues: {
          ":emptyObj": {},
        },
      })
    );

    // 5. 写入翻译内容到 translations.[lang]
    await ddbDocClient.send(
      new UpdateCommand({
        TableName: process.env.TABLE_NAME,
        Key: key,
        UpdateExpression: "SET #translations.#lang = :text",
        ExpressionAttributeNames: {
          "#translations": "translations",
          "#lang": language,
        },
        ExpressionAttributeValues: {
          ":text": translated,
        },
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        original: description,
        translated,
        cached: false,
      }),
    };
  } catch (err: any) {
    console.error("[ERROR]", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

function createDynamoDocClient() {
  const client = new DynamoDBClient({ region: process.env.REGION });
  return DynamoDBDocumentClient.from(client, {
    marshallOptions: {
      convertEmptyValues: true,
      removeUndefinedValues: true,
    },
    unmarshallOptions: { wrapNumbers: false },
  });
}
