import fs from 'fs'
import path from 'path'
import parseMarkdown from 'front-matter-markdown'
import gitChangedFiles from 'git-changed-files'
 
const __dirname = path.resolve()

const isDir = (path) => fs.lstatSync(path).isDirectory()
const isFile = (path) => fs.lstatSync(path).isFile()

const rootContentDir = '/content'
const contentDir = path.resolve(__dirname, 'content')
const content = fs.readdirSync(contentDir)

const entityName = "index.mdx"
function getEntities(dirPath) {
  const files = fs.readdirSync(dirPath)

  if (files.includes(entityName)) {
    const filePath = path.join(dirPath, entityName)
    const content = fs.readFileSync(filePath, 'utf8')
    const relativeDirPath = path.relative(__dirname, dirPath)
    const metaData = parseMarkdown(content)
    if (metaData.status != 'published') {
      return 
    }

    // //delete file
    // if (fs.existsSync(path.join(dirPath, 'images/images.json'))) {
    //   fs.unlinkSync(path.join(dirPath, 'images/images.json'))
    // }
    
    return {
      dirPath: relativeDirPath,
      indexPath: path.relative(__dirname, filePath),
      imagesPath: path.join(relativeDirPath, 'images'),
      imageUrl: metaData.image ? path.join(relativeDirPath, 'images', metaData.image) : null,
      ...metaData,
      // content
    }
  }

  const entities = []
  for (let file of files) {
    const filePath = path.join(dirPath, file)
    if (isDir(filePath)) {
      entities.push(getEntities(filePath))
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
function getSections() {
  let sections = {}
  for (let section of content) {
    // check is a dir
    const sectionPath = path.resolve(contentDir, section)
    if (!isDir(sectionPath)) {
      continue
    }
    
    const entities = getEntities(sectionPath)
    sections[section] = {
      entities: entities.sort((a, b) => new Date(b.date) - new Date(a.date))
    }
  }
  return sections

    const fileNames = fs.readdirSync(sectionPath)
    const files = fileNames
      .map((name) => {
        const entityPath = path.join(rootContentDir, section, name)
        return {
          name,
          path: entityPath,
          imagesPath: path.join(entityPath, 'images'),
          filePath: path.resolve(sectionPath, name)
        }
      })
      .filter((file) => isFile(file.filePath))
      .map(file => {
        const content = fs.readFileSync(file.filePath, 'utf8')
        return {
          ...file,
          ...parseMarkdown(content),
          // content
        }
      })

    sections[section] = files
  }
//   return sections
// }

const sections = getSections()
// console.log(sections.articles)
// sections = sections.sort((a, b) => +a.section.weight - +b.section.weight)



// Check for any duplicates
const uuids = {}
const slugs = {}
for (let section in sections) {
  for (let entity of sections[section].entities) {
    if (uuids[entity.id]) {
      throw 'Duplicate UUID' + JSON.stringify(uuids[entity.id], null, 2) + JSON.stringify(entity, null, 2)
    }
    uuids[entity.id] = entity
    
    if (slugs[entity.slug]) {
      throw 'Duplicate slug' + JSON.stringify(slugs[entity.slug], null, 2) + JSON.stringify(entity, null, 2)
    }
    slugs[entity.slug] = true
  }
}


fs.writeFileSync(path.resolve(__dirname, 'build.json'), JSON.stringify(sections, null, 2))

let committedGitFiles = await gitChangedFiles();
console.log(committedGitFiles)