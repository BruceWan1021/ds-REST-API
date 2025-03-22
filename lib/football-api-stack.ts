import * as cdk from "aws-cdk-lib";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
// import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as apig from "aws-cdk-lib/aws-apigateway";

export class RestAPIStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Tables 
    const matchesTable = new dynamodb.Table(this, "FootballMatchesTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "id", type: dynamodb.AttributeType.NUMBER },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "FootballMatches",
    });
    
    // Functions
    // Add Match 
    const addMatchFn = new lambdanode.NodejsFunction(
      this,
      "AddMatchFunction",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/addMatch.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: matchesTable.tableName,
          REGION: 'eu-west-1',
        },
      }
      );

      // Permissions 
      matchesTable.grantWriteData(addMatchFn)
     

      const api = new apig.RestApi(this, "FootballAPI", {
        description: "Football Match API",
        deployOptions: {
          stageName: "dev",
        },
        defaultCorsPreflightOptions: {
          allowHeaders: ["Content-Type", "X-Amz-Date"],
          allowMethods: ["OPTIONS", "GET", "POST"],
          allowCredentials: true,
          allowOrigins: ["*"],
        },
      });
    
      const matchesEndpoint = api.root.addResource("matches");
      matchesEndpoint.addMethod(
        "POST",
        new apig.LambdaIntegration(addMatchFn, { proxy: true })
      );
    }
  }
    