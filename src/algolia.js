import algoliasearch from 'algoliasearch'
import path from 'path'
import fs from 'fs'

const __dirname = path.resolve()

const client = algoliasearch(process.env.ALGOLIA_SEARCH_APP_ID, process.env.ALGOLIA_ADMIN_API_KEY);
const algoliaIndex = client.initIndex(process.env.ALGOLIA_SEARCH_POSTS_INDEX_NAME);

export async function deleteFromAlgolia(entity) {
  const by = {
    filters: `objectID:${entity.slug}`
  }
  await algoliaIndex.deleteBy(by)
}

export async function insertIntoAlgolia(e) {
  const entity = {...e}
  delete entity.hash
  const text = fs.readFileSync(path.join(__dirname, entity.indexPath)).toString().split('---')[2].trim()
  await algoliaIndex.saveObject({
    ...entity,
    objectID: entity.slug,
    text,
  })
}

export async function updateAlgolia(entities) {
  const algoliaObjects = entities.map(e => {
    const entity = {...e}
    delete entity.hash
    return {
      ...entity,
      objectID: entity.slug,
    }
  })
  await algoliaIndex.partialUpdateObjects(algoliaObjects)
}