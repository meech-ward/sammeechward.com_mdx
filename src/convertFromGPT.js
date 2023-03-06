import fs from 'fs'
import path from 'path'
import parseMarkdown from 'front-matter-markdown'
import sharp from 'sharp'

// import json from '../content/articles/dotnet/entitiy-framework-timestamps/chatGPT.json' assert { type: "json" }
import json from './tmp.json' assert { type: "json" }

const title = json.title
const timestamp = json.create_time

function fixMessageParts(parts) {
  return parts.map(str => str.replace(/\n\n(?=\d\.\s)/g, '\n')).join("\n\n")
}

const messages = Object.values(json.mapping).filter(m => m.message).map(m => ({
  message: fixMessageParts(m.message.content.parts),
  role: m.message.role
}))

const text = `# ${title}
<GPTChat>
${messages.map(m => (`

<GPTChatSection role="${m.role}">
${m.message}
</GPTChatSection>

`
)).join("")}
</GPTChat>
`

console.log(text)