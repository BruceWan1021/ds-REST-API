#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { FootballApiStack } from '../lib/football-api-stack';

const app = new cdk.App();
new FootballApiStack(app, 'FootballApiStack', { env: {region: "eu-west-1"}});