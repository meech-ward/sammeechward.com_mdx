import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, DynamoDBDocument } from "@aws-sdk/lib-dynamodb"
import { PutCommand, ScanCommand, UpdateCommand, GetCommand, ExecuteStatementCommand, QueryCommand } from "@aws-sdk/lib-dynamodb"

import dotenv from "dotenv"
dotenv.config()

const tableName = process.env.AWS_DYNAMO_TABLE_NAME
const region = process.env.AWS_DYNAMO_REGION
const accessKeyId = process.env.AWS_ACCESS_KEY
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY

const ddbConfig = {
  region,
  credentials: {
    accessKeyId,
    secretAccessKey
  }
}
console.log({ ddbConfig })
const ddbClient = new DynamoDBClient(ddbConfig)


const marshallOptions = {
  convertEmptyValues: true,
  removeUndefinedValues: true,
  convertClassInstanceToMap: true,
}

const unmarshallOptions = {
  wrapNumbers: false,
}

const translateConfig = { marshallOptions, unmarshallOptions }
const dynamodbClient = DynamoDBDocumentClient.from(ddbClient, translateConfig)


export async function putItem(Item) {
  const params = {
    TableName: tableName,
    Item
  }
  const data = await dynamodbClient.send(new PutCommand(params));
  return data
}

export async function putPost(post) {
  const sk = `${post.type.toUpperCase()}#${Math.floor(new Date(post.date).getTime() / 1000)}`
  const Item = {
    pk: "ENTITY#" + post.slug,
    sk,
    ...post
  }
  await putItem(Item)
}


export async function getAllPosts() {
  const params = {
    TableName: tableName,
    ProjectionExpression: "pk, sk, #h, slug",
    ExpressionAttributeNames: { "#h": "hash" },
  }

  const data = await dynamodbClient.send(new ScanCommand(params));
  return data.Items
}