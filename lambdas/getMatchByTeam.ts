import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { MatchTeamQueryParams } from "../shared/types";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  ScanCommandInput,
} from "@aws-sdk/lib-dynamodb";
import Ajv from "ajv";
import schema from "../shared/types.schema.json";

const ajv = new Ajv();
const isValidQueryParams = ajv.compile(
  schema.definitions["MatchTeamQueryParams"] || {}
);

const ddbDocClient = createDocumentClient();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    console.log("[EVENT]", JSON.stringify(event));
    const queryParams = event.queryStringParameters;

    if (!queryParams || !isValidQueryParams(queryParams)) {
      return {
        statusCode: 400,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: "Invalid query parameters",
          schema: schema.definitions["MatchTeamQueryParams"],
        }),
      };
    }

    const { teamNameA, teamNameB } = queryParams;

    const filterConditions: string[] = [];
    const expressionValues: Record<string, any> = {};

    if (teamNameA) {
      filterConditions.push("contains(teamNames, :tA)");
      expressionValues[":tA"] = teamNameA;
    }

    if (teamNameB) {
      filterConditions.push("contains(teamNames, :tB)");
      expressionValues[":tB"] = teamNameB;
    }

    const commandInput: ScanCommandInput = {
      TableName: process.env.TABLE_NAME,
      ...(filterConditions.length > 0 && {
        FilterExpression: filterConditions.join(" AND "),
        ExpressionAttributeValues: expressionValues,
      }),
    };

    const commandOutput = await ddbDocClient.send(
      new ScanCommand(commandInput)
    );

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        data: commandOutput.Items || [],
      }),
    };
  } catch (error: any) {
    console.error("[ERROR]", error);
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: error.message || error }),
    };
  }
};

function createDocumentClient() {
  const ddbClient = new DynamoDBClient({ region: process.env.REGION });
  return DynamoDBDocumentClient.from(ddbClient, {
    marshallOptions: {
      convertEmptyValues: true,
      removeUndefinedValues: true,
      convertClassInstanceToMap: true,
    },
    unmarshallOptions: {
      wrapNumbers: false,
    },
  });
}
