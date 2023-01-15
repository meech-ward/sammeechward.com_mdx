import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, DynamoDBDocument } from "@aws-sdk/lib-dynamodb"
import { PutCommand, ScanCommand, DeleteCommand, UpdateCommand, GetCommand, ExecuteStatementCommand, QueryCommand } from "@aws-sdk/lib-dynamodb"

import dotenv from "dotenv"
dotenv.config()

const tableName = process.env.AWS_DYNAMO_POSTS_TABLE_NAME
const secondTableName = process.env.AWS_DYNAMO_OTHER_TABLE_NAME
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


export async function putItem(Item, TableName = tableName) {
  const params = {
    TableName,
    Item
  }
  const data = await dynamodbClient.send(new PutCommand(params));
  return data
}

export async function getItem(Key) {
  const params = {
    TableName: tableName,
    Key
  }
  const data = await dynamodbClient.send(new GetCommand(params));
  return data
}

function postType(entity) {
  if (entity.type == "playlist") {
    return "PLAYLIST"
  }
  return "POST"
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
    GSI1PK: "ENTITY#" + postType(post),
    GSI1SK
  }
  await putItem(Item)
}

export async function putPlaylistPost({ post, playlist }) {
  const Item = {
    ...post,
    pk: "PLAYLIST#" + playlist.slug,
    sk: "ENTITY#" + post.slug,
    playlist: {
      slug: playlist.slug,
      title: playlist.title,
      description: playlist.description,
      image: playlist.image,
    }
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

export async function getSetting(pk, sk) {
  const Key = {
    pk: "SETTING#" + pk,
    sk: "SETTING#" + sk
  }
  return (await getItem(Key)).Item
}


export async function getAllPosts() {
  const params = {
    TableName: tableName,
    ProjectionExpression: "pk, sk, #h, slug, commentCount, likeCount, modified, dirPath",
    ExpressionAttributeNames: { "#h": "hash" },
  }

  const data = await dynamodbClient.send(new ScanCommand(params));
  return data.Items.filter(i => i.pk.startsWith("ENTITY#"))
}


export async function getAllComments() {
  const params = {
    TableName: secondTableName,
    ProjectionExpression: "pk,sk, GSI1PK,GSI1SK,GSI2PK,GSI2SK,#name,email,image,#text,created",
    ExpressionAttributeNames: { "#name": "name", "#text": "text" },
  }

  const data = await dynamodbClient.send(new ScanCommand(params));
  return data.Items.filter(i => i.sk.startsWith("COMMENT#"))
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

export function queryPlaylist(playlist) {
  const params = {
    TableName: tableName,
    KeyConditionExpression: "pk = :pk",
    ExpressionAttributeValues: {
      ":pk": "PLAYLIST#" + playlist.slug,
    }
  }
  return dynamodbClient.send(new QueryCommand(params));
}

export async function deletePost({ sk, pk }) {
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

export async function deletePlaylistChildren(playlist) {
  const children = (await queryPlaylist(playlist)).Items
  const childrenToDelete = children.filter(child => !playlist.children.includes(child.slug))
  for (const child of childrenToDelete) {
    const params = {
      TableName: tableName,
      Key: {
        pk: "PLAYLIST#" + playlist.slug,
        sk: "ENTITY#" + child.slug,
      }
    }
    await dynamodbClient.send(new DeleteCommand(params));
  }
}
export async function deletePlaylistChild({ playlist, post }) {
  const params = {
    TableName: tableName,
    Key: {
      pk: "PLAYLIST#" + playlist.slug,
      sk: "ENTITY#" + post.slug,
    }
  }
  const data = await dynamodbClient.send(new DeleteCommand(params));
  return data
}
