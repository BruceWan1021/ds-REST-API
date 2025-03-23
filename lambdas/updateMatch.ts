import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import Ajv from "ajv";
import schema from "../shared/types.schema.json";

const ajv = new Ajv();
const isValidBody = ajv.compile(schema.definitions["MatchUpdate"] || {});
const ddbDocClient = createDynamoDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    console.log("[EVENT]", JSON.stringify(event));

    const matchId = event.pathParameters?.matchId;
    const teamName = event.pathParameters?.teamName;

    if (!matchId) {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "Missing matchId in path." }),
      };
    }

    const body = event.body ? JSON.parse(event.body) : undefined;
    if (!body || !isValidBody(body)) {
      return {
        statusCode: 500,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: "Invalid body. Must match MatchUpdate schema.",
          schema: schema.definitions["MatchUpdate"],
        }),
      };
    }

    const updateExpressionParts: string[] = [];
    const expressionAttributeValues: Record<string, any> = {};
    const expressionAttributeNames: Record<string, string> = {};

    if (body.description) {
      updateExpressionParts.push("#desc = :desc");
      expressionAttributeNames["#desc"] = "description";
      expressionAttributeValues[":desc"] = body.description;
    }

    if (body.teamNameA) {
      updateExpressionParts.push("#teamA = :teamA");
      expressionAttributeNames["#teamA"] = "teamNameA";
      expressionAttributeValues[":teamA"] = body.teamNameA;
    }

    if (body.teamNameB) {
      updateExpressionParts.push("#teamB = :teamB");
      expressionAttributeNames["#teamB"] = "teamNameB";
      expressionAttributeValues[":teamB"] = body.teamNameB;
    }

    if (body.teamNameA || body.teamNameB) {
      const teamNames: string[] = [
        body.teamNameA ?? undefined,
        body.teamNameB ?? undefined,
      ].filter(Boolean) as string[];

      updateExpressionParts.push("#teamNames = :teamNames");
      expressionAttributeNames["#teamNames"] = "teamNames";
      expressionAttributeValues[":teamNames"] = teamNames;
    }

    const updateExpression = "SET " + updateExpressionParts.join(", ");

    await ddbDocClient.send(
      new UpdateCommand({
        TableName: process.env.TABLE_NAME,
        Key: {
          matchId: parseInt(matchId),
          teamName: teamName,
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames,
      })
    );

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "Match updated successfully" }),
    };
  } catch (error: any) {
    console.error("[ERROR]", error);
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: error.message }),
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
