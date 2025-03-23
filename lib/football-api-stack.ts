import * as cdk from "aws-cdk-lib";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import { matches } from "../seed/matches"
import { generateBatch } from "../shared/util";
import * as apig from "aws-cdk-lib/aws-apigateway";
import * as iam from "aws-cdk-lib/aws-iam";

export class FootballApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Tables 
    const matchesTable = new dynamodb.Table(this, "FootballMatchesTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "matchId", type: dynamodb.AttributeType.NUMBER },
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
        entry: `${__dirname}/../lambdas/addMatches.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: matchesTable.tableName,
          REGION: 'eu-west-1',
        },
      }
    );

    const getAllMatchesFn = new lambdanode.NodejsFunction(
      this,
      "GetAllMatchesFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/getAllMatches.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: matchesTable.tableName,
          REGION: 'eu-west-1',
        },
      }
    );

    const getMatchByIdFn = new lambdanode.NodejsFunction(
      this,
      "GetMatchByIdFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/getMatchById.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: matchesTable.tableName,
          REGION: 'eu-west-1',
        },
      }
    );

    const getMatchByTeamFn = new lambdanode.NodejsFunction(
      this,
      "GetMatchByTeamFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/getMatchByTeam.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: matchesTable.tableName,
          REGION: 'eu-west-1',
        },
      }
    );

    const updateMatchFn = new lambdanode.NodejsFunction(
      this, 
      "UpdateMatchFn", 
      {
        
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/updateMatch.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: matchesTable.tableName,
          REGION: 'eu-west-1',
        },
      }
    );

    const getMatchTranslationFn = new lambdanode.NodejsFunction(
      this,
      "GetMatchTranslationFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/getMatchTranslation.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: matchesTable.tableName,
          REGION: 'eu-west-1',
        },
      }
    )

    new custom.AwsCustomResource(this, 'MatchesSeeder', {
      onCreate: {
        service: "DynamoDB",
        action: "batchWriteItem",
        parameters: {
          RequestItems: {
            [matchesTable.tableName]: generateBatch(matches),
          },
        },
        physicalResourceId: custom.PhysicalResourceId.of("MatchesSeederInit"), 
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [matchesTable.tableArn],  
      }),
    })

      // Permissions 
    matchesTable.grantWriteData(addMatchFn)
    matchesTable.grantReadData(getAllMatchesFn)
    matchesTable.grantReadData(getMatchByIdFn)
    matchesTable.grantReadData(getMatchByTeamFn)
    matchesTable.grantReadWriteData(updateMatchFn)
    matchesTable.grantReadWriteData(getMatchTranslationFn);

    getMatchTranslationFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["translate:TranslateText"],
        resources: ["*"],
      })
    );
     
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
    matchesEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(getAllMatchesFn, { proxy: true })
    );

    const matchEndpoint = matchesEndpoint.addResource("{matchId}");
    matchEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(getMatchByIdFn, { proxy: true })
    );
    matchEndpoint.addMethod(
      "PUT",
      new apig.LambdaIntegration(updateMatchFn)
    );

    const matchByTeamEndpoint = matchesEndpoint.addResource("by-team"); 
    matchByTeamEndpoint.addMethod(
      "GET", 
      new apig.LambdaIntegration(getMatchByTeamFn)
    );

    const translationEndpoint = matchEndpoint.addResource("translation");
    translationEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(getMatchTranslationFn)
    );
  }
}

