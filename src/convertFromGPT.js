import fs from 'fs'
import path from 'path'
import parseMarkdown from 'front-matter-markdown'
import sharp from 'sharp'

import json from '../content/articles/dotnet/entitiy-framework-timestamps/chatGPT.json' assert { type: "json" }

const title = json.title
const timestamp = json.create_time

const messages = Object.values(json.mapping).filter(m => m.message).map(m => ({
  messageParts: m.message.content.parts,
  role: m.message.role
}))

const text = `# ${title}
<GPTChat>
${messages.map(m => (`

<GPTChatSection role="${m.role}">
${m.messageParts.join("\n\n")}
</GPTChatSection>

`
)).join("")}
</GPTChat>
`

console.log(text)