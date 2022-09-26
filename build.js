import fs from 'fs'
import path from 'path'
import parseMarkdown from 'front-matter-markdown'

const __dirname = path.resolve()

const isDir = (path) => fs.lstatSync(path).isDirectory()
const isFile = (path) => fs.lstatSync(path).isFile()

const rootContentDir = '/content'
const contentDir = path.resolve(__dirname, 'content')
const content = fs.readdirSync(contentDir)

// const entityName = "index.mdx"
// function getEntities(dirPath) {
//   const files = fs.readdirSync(dirPath)
//   if (files.includes(entityName)) {
//     const content = fs.readFileSync(path.join(dirPath, entityName), 'utf8')
//     return {
//       ...file,
//       ...parseMarkdown(content),
//       // content
//     }
//   }
// }
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
  return sections
}

const sections = getSections()
console.log(sections.articles[0])
// sections = sections.sort((a, b) => +a.section.weight - +b.section.weight)

fs.writeFileSync(path.resolve(__dirname, 'build.json'), JSON.stringify(sections, null, 2))