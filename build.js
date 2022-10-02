import fs from 'fs'
import path from 'path'
import parseMarkdown from 'front-matter-markdown'
import sharp from 'sharp'
import { hashElement } from 'folder-hash'

import currentBuild from './build.json' assert {type: "json"}
 
const __dirname = path.resolve()

const isDir = (path) => fs.lstatSync(path).isDirectory()
const isFile = (path) => fs.lstatSync(path).isFile()

const contentDir = path.resolve(__dirname, 'content')
const content = fs.readdirSync(contentDir)

function getEntity(sections, id) {
  for (let section in sections) {
    const entity = sections[section].entities.find(e => e.id === id)
    if (entity) {
      return entity
    }
  }
}

let changed = []
async function getEntities(dirPath) {
  const files = fs.readdirSync(dirPath)
  
  const entityName = "index.mdx"
  if (files.includes(entityName)) {
    const filePath = path.join(dirPath, entityName)
    const content = fs.readFileSync(filePath, 'utf8')
    const relativeDirPath = path.relative(__dirname, dirPath)
    const metaData = parseMarkdown(content)
    if (metaData.status != 'published') {
      return 
    }


    // Get current version
    const currentVersion = getEntity(currentBuild, metaData.id)

    // Check for changes 
    const hash = await hashElement(dirPath, {encoding: 'hex'})
    const folderHash = hash.hash
    if (currentVersion && currentVersion.hash === folderHash) {
      return currentVersion
    }
    
    // console.log("Building", metaData.id, metaData.title)
    changed.push(metaData.id)

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
      console.log(metaData.image)
    }

    // hash for caching 

    // console.log("hash", JSON.parse(hash.toString()).hash)

    
    return {
      ...metaData,
      dirPath: relativeDirPath,
      indexPath: path.relative(__dirname, filePath),
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
  let sections = {}
  for (let section of content) {
    // check is a dir
    const sectionPath = path.resolve(contentDir, section)
    if (!isDir(sectionPath)) {
      continue
    }
    
    const entities = await getEntities(sectionPath)
    sections[section] = {
      entities: entities.sort((a, b) => new Date(b.date) - new Date(a.date))
    }
  }
  return sections
}

const sections = await getSections()

// Check for any duplicates
const uuids = {}
const slugs = {}
for (let section in sections) {
  for (let entity of sections[section].entities) {
    if (uuids[entity.id]) {
      throw 'Duplicate UUID ' + JSON.stringify(uuids[entity.id], null, 2) + JSON.stringify(entity, null, 2)
    }
    uuids[entity.id] = entity
    
    if (slugs[entity.slug]) {
      throw 'Duplicate slug ' + JSON.stringify(slugs[entity.slug], null, 2) + JSON.stringify(entity, null, 2)
    }
    slugs[entity.slug] = entity
  }
}


fs.writeFileSync(path.resolve(__dirname, 'build.json'), JSON.stringify(sections, null, 2))
console.log(changed)