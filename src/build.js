import fs from 'fs'
import path from 'path'
import parseMarkdown from 'front-matter-markdown'
import sharp from 'sharp'
import { hashElement } from 'folder-hash'

import { putPost, getAllPosts, deletePost, putSetting, queryPost, getSetting } from './dynamo.js'

import algoliasearch from 'algoliasearch'

import axios from 'axios'

const posts = await getAllPosts()

const __dirname = path.resolve()

const isDir = (path) => fs.lstatSync(path).isDirectory()
const isFile = (path) => fs.lstatSync(path).isFile()

const contentDir = path.resolve(__dirname, 'content')
const content = fs.readdirSync(contentDir)

let changed = new Set()
let created = new Set()
let deleted = new Set(posts.map(p => p.slug))
async function getEntities(dirPath) {
  const files = fs.readdirSync(dirPath)

  const entityName = "index.mdx"
  if (files.includes(entityName)) {
    const filePath = path.join(dirPath, entityName)
    const content = fs.readFileSync(filePath, 'utf8')
    const relativeDirPath = path.relative(path.join(__dirname, ""), dirPath)
    const metaData = parseMarkdown(content)

    if (metaData.status != 'published') {
      return
    }

    if (deleted.has(metaData.slug)) {
      // Entity is still there
      // and potentially bing updated
      deleted.delete(metaData.slug)
    } else {
      // Entity is new
      created.add(metaData.slug)
    }


    // Get current version
    const currentVersion = posts.find(p => p.slug === metaData.slug)
    // Check for changes 
    const hash = await hashElement(dirPath, { encoding: 'hex' })
    const folderHash = hash.hash
    if (currentVersion && currentVersion.hash === folderHash) {
      // No changes
      
    } else {
      // console.log("Building", metaData.id, metaData.title)
      if (!created.has(metaData.slug)) {
        changed.add(metaData.slug)
      }
    }

    // //delete file
    // if (fs.existsSync(path.join(dirPath, 'images/images.json'))) {
    //   fs.unlinkSync(path.join(dirPath, 'images/images.json'))
    // }

    // Auto width and height
    if (metaData.image && !metaData.image.width || !metaData.image.height) {
      const imageFile = fs.readFileSync(path.join(dirPath, 'images', metaData.image.name))
      const image = await sharp(imageFile);
      const imageMetadata = await image.metadata();
      metaData.image.width = imageMetadata.width
      metaData.image.height = imageMetadata.height
      // console.log(metaData.image)
    }

    // hash for caching 

    // console.log("hash", JSON.parse(hash.toString()).hash)


    return {
      ...currentVersion,
      ...metaData,
      dirPath: relativeDirPath,
      indexPath: path.relative(path.join(__dirname, ""), filePath),
      imagesPath: path.join(relativeDirPath, 'images'),
      image: {
        ...metaData.image,
        url: metaData.image?.name ? path.join(relativeDirPath, 'images', metaData.image?.name) : null,
      },
      hash: folderHash
    }
  }

  const entities = []
  for (let file of files) {
    const filePath = path.join(dirPath, file)
    if (isDir(filePath)) {
      entities.push(await getEntities(filePath))
    }
  }

  return entities.flat().filter(a => a)
}
/**
 * Loop through all sections in the content directory
 * Build a list of all different sections
 * Within a section, compile all entities/pages (index.mdx)
 * @returns 
 */
async function getSections() {
  let all = []
  for (let section of content) {
    // check is a dir
    const sectionPath = path.resolve(contentDir, section)
    if (!isDir(sectionPath)) {
      continue
    }

    const entities = await getEntities(sectionPath)
    all.push(entities)

  }
  return all.flat().sort((a, b) => new Date(b.date) - new Date(a.date))
}

const sections = await getSections()

// Check for any duplicates, throw if there are any
const slugs = {}
for (let entity of sections) {

  if (slugs[entity.slug]) {
    throw 'Duplicate slug ' + JSON.stringify(slugs[entity.slug], null, 2) + JSON.stringify(entity, null, 2)
  }
  slugs[entity.slug] = entity
}

// Check for any bad slugs, throw if there are any
const badCharacters = /[^a-z0-9-]/
const badSlugs = []
for (const slug in slugs) {
  if (badCharacters.test(slug)) {
    badSlugs.push(slug)
  }
}
if (badSlugs.length > 0) {
  throw 'Bad slugs ' + JSON.stringify(badSlugs, null, 2)
}


// Add, update, and delete entities from algolia and dynamo

const client = algoliasearch(process.env.ALGOLIA_SEARCH_APP_ID, process.env.ALGOLIA_ADMIN_API_KEY);
const algoliaIndex = client.initIndex(process.env.ALGOLIA_SEARCH_POSTS_INDEX_NAME);

async function deleteFromAlgolia(entity) {
  const by = {
    filters: `objectID:${entity.slug}`
  }
  console.log(by)
  await algoliaIndex.deleteBy(by)
}

async function insertIntoAlgolia(e) {
  const entity = {...e}
  delete entity.hash
  const text = fs.readFileSync(path.join(__dirname, entity.indexPath)).toString().split('---')[2].trim()
  await algoliaIndex.saveObject({
    ...entity,
    objectID: entity.slug,
    text,
  })
}

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

const revalidateSlugs = [...Array.from(created), ...Array.from(changed)].map(a => "/" + a)
if (revalidateSlugs.length > 0) {
  revalidateSlugs.push("/posts")
}

// Home Page

putSetting("featured", "featured-1", sections.find(e => e.slug === "useeffect-everything-you-need-to-know"))
putSetting("featured", "featured-2", sections.find(e => e.slug === "storing-images-in-s3-from-node-server"))
putSetting("featured", "featured-3", sections.find(e => e.slug === "100-dollar-diy-ebike"))

const mostRecentVideo = sections.find(e => e.type === 'video')

const previousMostRecent = await getSetting("most-recent-video", "most-recent-video")
console.log({previousMostRecent, mostRecentVideo})
if (previousMostRecent?.slug !== mostRecentVideo?.slug) {
  await putSetting("most-recent-video", "most-recent-video", mostRecentVideo)
  revalidateSlugs.push("/")
}


// Revalidation

await axios.post(process.env.ROOT_URL + '/api/revalidate', {
  secret: process.env.REVALIDATION_TOKEN,
  slugs: revalidateSlugs
})
