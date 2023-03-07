// Turn all the mdx files into meaningful js data

import fs from 'fs'
import path from 'path'
import parseMarkdown from 'front-matter-markdown'
import sharp from 'sharp'
import { hashElement } from 'folder-hash'

const __dirname = path.resolve()

const isDir = (path) => fs.lstatSync(path).isDirectory()
const isFile = (path) => fs.lstatSync(path).isFile()


export async function getEntities(dirPath, posts) {
  let changed = new Set()
  let created = new Set()
  let deleted = new Set(posts.map(p => p.slug))

  async function _getEntities(dirPath) {
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
      if (currentVersion && currentVersion.hash === folderHash && currentVersion.dirPath === relativeDirPath) {
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
        entities.push(await _getEntities(filePath))
      }
    }

    return entities.flat().filter(a => a)
  }
  const entities = await _getEntities(dirPath)

  return {
    entities,
    changed,
    created,
    deleted
  }
}
/**
 * Loop through all sections in the content directory
 * Build a list of all different sections
 * Within a section, compile all entities/pages (index.mdx)
 * @returns 
 */
export async function getSections(contentDir, content, posts) {
  let all = []
  let allChanged = new Set()
  let allCreated = new Set()
  let allDeleted = new Set(posts.map(p => p.slug))
  for (let section of content) {
    // check is a dir
    const sectionPath = path.resolve(contentDir, section)
    if (!isDir(sectionPath)) {
      continue
    }

    const { entities, changed, created } = await getEntities(sectionPath, posts)
    allChanged = new Set([...allChanged, ...changed])
    allCreated = new Set([...allCreated, ...created])
    all.push(entities)
  }
  
  const sections = all.flat().sort((a, b) => new Date(b.date) - new Date(a.date))
  sections.forEach(section => allDeleted.delete(section.slug))

  return { sections, allEntities: all, allChanged, allCreated, allDeleted }
}

export function verifySlugs(sections) {


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

  return slugs
}