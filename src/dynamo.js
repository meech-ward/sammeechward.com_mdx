import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, DynamoDBDocument } from "@aws-sdk/lib-dynamodb"
import { PutCommand, ScanCommand, DeleteCommand, UpdateCommand, GetCommand, ExecuteStatementCommand, QueryCommand } from "@aws-sdk/lib-dynamodb"

import dotenv from "dotenv"
dotenv.config()

const tableName = process.env.AWS_DYNAMO_POSTS_TABLE_NAME
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
  const GSI1SK = `${Math.floor(new Date(post.date).getTime() / 1000)}#${post.type.toUpperCase()}`
  const Item = {
    commentCount: 0,
    likeCount: 0,
    ...post,
    pk: "ENTITY#" + post.slug,
    sk,
    GSI1PK: "ENTITY#POST",
    GSI1SK
  }
  await putItem(Item)
}

export async function putSetting(pk, sk, data) {
  const Item = {
    ...data,
    pk: "SETTING#" + pk,
    sk: "SETTING#" + sk
  }
  await putItem(Item)
}


export async function getAllPosts() {
  const params = {
    TableName: tableName,
    ProjectionExpression: "pk, sk, #h, slug, commentCount, likeCount, modified",
    ExpressionAttributeNames: { "#h": "hash" },
  }

  const data = await dynamodbClient.send(new ScanCommand(params));
  return data.Items.filter(i => i.pk.startsWith("ENTITY#"))
}

export function queryPost(post) {
  const params = {
    TableName: tableName,
    KeyConditionExpression: "pk = :pk",
    ExpressionAttributeValues: {
      ":pk": "ENTITY#" + post.slug,
    }
  }
  return dynamodbClient.send(new QueryCommand(params));
}

export async function deletePost({sk, pk}) {
  const params = {
    TableName: tableName,
    Key: {
      pk,
      sk
    }
  }
  const data = await dynamodbClient.send(new DeleteCommand(params));
  return data
}