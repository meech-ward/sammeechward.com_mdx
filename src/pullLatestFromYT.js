import {google} from 'googleapis'
import axios from 'axios'

import path from 'path'
import fs from 'fs'

import dotenv from 'dotenv'
dotenv.config()

const __dirname = path.resolve()

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY
});

const mdReplacer = {
  links (md) {
    function replacer(match, p1, offset, string) {
      return `[${p1}](${p1})` 
    }
    const regex = /(http.*?(?=\s))/g
    return md.replace(regex, replacer)
  }
}

function getHashTags(content) {
  const hashtagRegex = /#\w+/g;
  const matches = content.match(hashtagRegex) || [];
  const hashTags = matches.map((tag) => tag.slice(1));
  return hashTags
}

function convertVideoToMarkdown(video) {
  const content = video.snippet.description
  const hashTags = getHashTags(video.snippet.title)

  let md = `---
type: video
yt_id: ${video.id}
videoId: ${video.contentDetails.videoId}
title: "${video.title}"
date: "${video.snippet.publishedAt}"
slug: "${video.slug}"
image: 
  name: "${video.image.name}"
  alt: "${video.image.alt}"
  width: ${video.image.width}
  height: ${video.image.height}
status: 'published'
description: "${video.snippet.description.split('\n')[0]}"
tags: []${hashTags.length ? `\nhashtags: ${JSON.stringify(hashTags)}\nis_short: true` : ''}
---

${mdReplacer.links(content).split("🔗Moar Links")[0].split('\n').map(line => {
  if (line.startsWith('#') || !isNaN(+line[0])) {
    return `* ${line}`
  } 
  if (line.toLowerCase().startsWith('chapters')) {
    return `## Chapters:\n`
  }
  return line
}).join('\n')}
`

return md
}


async function createFileForVideo(video) {
  const slug = video.snippet.title.toLowerCase() // Convert the whole title to lower case
  .replace(/[\+\?#\.\|\-\_,\(\)\!':]/g, '') // Remove specified characters
  .replace(/\s+/g, '-') // Replace all kinds of whitespace with a single dash
  .replace(/&/g, 'and') // Replace ampersand with 'and'
  .replace(/-+/g, '-'); // Replace multiple dashes with a single dash
  video.slug = slug
  video.title = video.snippet.title

  // Setup directories
  const contentDir = path.resolve(__dirname, 'content')
  const videosDir = path.resolve(contentDir, `videos`)
  const videoDir = path.resolve(videosDir, video.slug)
  const videoImagesDir = path.resolve(videoDir, 'images')
  fs.mkdirSync(videoImagesDir, { recursive: true })


  // handle main image
  let thumbnail 
  for (const kind of ["maxres", "standard", "high", "medium", "default"]) {
    if (video.snippet.thumbnails[kind]) {
      thumbnail = video.snippet.thumbnails[kind]
      break
    }
  }
  const imageExtension = thumbnail?.url?.split('.').pop()
  const image = {
    name: `${slug}.${imageExtension}`,
    alt: video.snippet.title,
    width: thumbnail?.width || null,
    height: thumbnail?.height || null
  }
  video.image = image
  if (thumbnail) {
    const mainImageResult = await axios.get(thumbnail.url, { responseType: 'arraybuffer' })
    fs.writeFileSync(path.resolve(videoImagesDir, image.name), mainImageResult.data)
  }

  // handle markdown
  const md = convertVideoToMarkdown(video)
  fs.writeFileSync(path.resolve(videoDir, 'index.mdx'), md)
}


const uploadsId = await youtube.channels.list({
  part: 'contentDetails',
  // forUsername: 'sammeechward'
  id: 'UC6aTLuI_j4-0wiDSzmaPctQ'
}).then((res) => {
  return res.data.items[0].contentDetails.relatedPlaylists.uploads
})


const mostRecentUpload = await youtube.playlistItems.list({
  part: 'snippet,contentDetails',
  maxResults: 2,
  playlistId: uploadsId
})
await Promise.all(mostRecentUpload.data.items.map(createFileForVideo))

// console.log(uploadsId, mostRecentUpload.data.items)
