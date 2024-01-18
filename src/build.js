import fs from 'fs'
import path from 'path'

import { putPost, getAllPosts, deletePost, putSetting, queryPost, getSetting, putPlaylistPost, deletePlaylistChildren, deletePlaylistChild } from './dynamo.js'

import { deleteFromAlgolia, insertIntoAlgolia } from './algolia.js'

import { getSections, verifySlugs, getEntities } from './files.js'

import axios from 'axios'

const posts = await getAllPosts()

const __dirname = path.resolve()

const contentDir = path.resolve(__dirname, 'content')
const content = fs.readdirSync(contentDir)


const {sections, allEntities, allChanged: changed, allCreated: created, allDeleted: deleted } = await getSections(contentDir, content, posts)
const slugs = verifySlugs(sections)


// Add, update, and delete entities from algolia and dynamo

const dateFormat = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

console.log({ changed })
// delete the existing ones and replace them with new ones
for (let slug of changed) {
  const entity = sections.find(e => e.slug === slug)
  delete entity.skipSize
  entity.modified = dateFormat(new Date()),
    await deleteFromAlgolia(entity)
  await insertIntoAlgolia(entity)
  const oldPost = (await queryPost(entity)).Items[0]
  if (oldPost) {
    await deletePost(oldPost)
  }
  await putPost(entity)
  console.log("put", slug)
}

console.log({ created })
// Create new ones
for (let slug of created) {
  const entity = sections.find(e => e.slug === slug)
  delete entity.skipSize
  entity.modified = dateFormat(new Date(entity.date)),
    await insertIntoAlgolia(entity)
  await putPost(entity)
  console.log("put", slug)
}

console.log({ deleted })
// delete old ones
for (let slug of deleted) {
  const entity = posts.find(e => e.slug === slug)
  await deleteFromAlgolia(entity)
  await deletePost(entity)
  console.log("delete", slug)
}

// Revalidation

let revalidateSlugs = [...Array.from(created), ...Array.from(changed)].map(a => "/" + a)
if (revalidateSlugs.length > 0) {
  revalidateSlugs.push("/posts")
}

// Playlist 
const playlists = sections.filter(e => e.type === 'playlist')
for (let playlist of playlists) {
  let children = playlist.children
  if (children.length === 0) {
    continue
  }
  // If there are sections, then flatmap it for now
  if (typeof children[0] !== 'string') {
    children = children.flatMap(e => e.children)
  }

  children = children.map(slug => sections.find(e => e.slug === slug))
  let childrenToChange = []
  let childrenToDelete = []

  const playlistCreatedOrChanged = created.has(playlist.slug) || changed.has(playlist.slug)
  if (playlistCreatedOrChanged) {
    // nuke
    await deletePlaylistChildren(playlist)
    childrenToChange = children
    // console.log("nuke", childrenToChange)
  } else {
    childrenToChange = playlist.children.filter(e => changed.has(e.slug) || created.has(e.slug))
    childrenToDelete = playlist.children.filter(e => deleted.has(e.slug))
  }

  await Promise.all(childrenToDelete.map(child => deletePlaylistChild({ post: child, playlist })))
  await Promise.all(childrenToChange.map(child => putPlaylistPost({ post: child, playlist })))
  if (childrenToChange.length > 0 || childrenToDelete.length > 0) {
    revalidateSlugs = [...revalidateSlugs, ...childrenToChange.map(e => "/" + e.slug)]
  }
  // console.log({childrenToChange, childrenToDelete})
}



// Home Page

putSetting("featured", "featured-1", sections.find(e => e.slug === "i-stopped-using-expressjs-because-bun-and-hono"))
putSetting("featured", "featured-2", sections.find(e => e.slug === "storing-images-in-s3-from-node-server"))
putSetting("featured", "featured-3", sections.find(e => e.slug === "underated-database-trick-database-sql-mysql-webdevelopment-programming-coding"))

const mostRecentVideo = sections.find(e => e.type === 'video')

const previousMostRecent = await getSetting("most-recent-video", "most-recent-video")
if (previousMostRecent?.slug !== mostRecentVideo?.slug) {
  await putSetting("most-recent-video", "most-recent-video", mostRecentVideo)
}


// Revalidation
revalidateSlugs = [...new Set(revalidateSlugs)]
// console.log(sections)
revalidateSlugs = revalidateSlugs.map(slug => {
  const entity = sections.find(e => e.slug === slug.replace('/', ''))
  if (!entity) {
    console.log("no entity for slug", slug)
    return slug
  }
  if (entity.type === 'playlist') {
    return `/playlists${slug}`
  }
  return slug
})


revalidateSlugs.push("/")
revalidateSlugs.push("/playlists")
revalidateSlugs.push("/posts")

try {
  await axios.post(process.env.ROOT_URL + '/api/revalidate', {
    secret: process.env.REVALIDATION_TOKEN,
    slugs: revalidateSlugs
  })
  console.log("revalidated", revalidateSlugs)
} catch (error) {
  console.log("error revalidating")
  console.log(error.response)
}
