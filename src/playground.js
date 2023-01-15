import { queryPost, putPost, getAllComments, putItem } from './dynamo.js'

const secondTableName = process.env.AWS_DYNAMO_OTHER_TABLE_NAME
const comments = await getAllComments()
// console.log(comments)
const results = await Promise.all(comments.map(comment => {
  comment.GSI2PK = "COMMENT"
  comment.GSI2SK = comment.sk
  return putItem(comment, secondTableName)
}))

console.log(results)

// const posts = await queryPost({ slug: 'sql-injection-sql-is-demon-spawn' })
// const post = posts.Items[0]

// post.likeCount = post.likeCount + 1
// post.commentCount = post.commentCount + 1
// await putPost(post)

// console.log(post)


// console.log({ deleted })
// for (let slug of ["worlds-first-razor-blade-advent-calendar"]) {
//   const entities = posts.filter(e => e.slug === slug)
//   const result = await deleteFromAlgolia({slug})
//   console.log("algolio delete", slug, result)
//   await Promise.all(entities.map(deletePost))
//   console.log("delete", slug)
// }

// for (let entity of sections) {
//   delete entity.skipSize
//   const text = fs.readFileSync(path.join(__dirname, entity.indexPath)).toString().split('---')[2].trim()
//   entity.text = text
// }

// fs.writeFileSync(path.resolve(__dirname, 'build.json'), JSON.stringify(sections, null, 2))

// https://www.algolia.com/doc/guides/getting-started/quick-start/#using-your-data
