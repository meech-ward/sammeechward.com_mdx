Each entity has an `index.mdx` file, an `images` directory, and any other directories that might be useful, such as an `assets` directory. 

## Frontmatter Example

```mdx 
---
type: article
title: 'SQL & DDL: A Quick Guide to Creating Tables'
date: '2020-02-02T23:39:19'
slug: 'some-unique-slug'
image: 
  name: 'name-of-image-in-images-directory.png'
  width: 1000
  height: 1000
status: 'published' | 'draft'
description: 'A short summary that will appear in the list of articles page'
tags: ['can be helpful for algolia search']
---
```

## Components

## Image

All local images should use this to benefit from next images. Make sure images are in the images directory or assets directory.

```mdx
<Image name="/images/name-of-image-in-images-directory.png" width={1000} height={1000} />
<Image name="/assets/name-of-image-in-images-directory.png" width={1000} height={1000} />
```

## Note

```mdx
<Note>
  This is a note
</Note>
```

## Warning

```mdx
<Warning>
  This is a warning
</Warning>
```

## Instruction

```mdx
<Instruction>
  This is an instruction
</Instruction>
```

## Error

```mdx
<Error>
  This is an error
</Error>
```

## PostCard

Display a card element for a post. The slug is the unique slug of the post.

```mdx
<PostCard slug="some-unique-slug" />
```

## Tabs

Display a tabbed element where each tab is a child of the Tabs component. Only one tab appears at a single time. This is handy for code examples in multiple languages.

```mdx
<Tabs>
  <Tab name="JS">
    ```sh
    npx create-next-app
    ```
</Tab>
  <Tab name="TS">
    ```sh
    npx create-next-app --ts
    ```
  </Tab>
</Tabs>
```


## YouTube

For youtube videos. This hasn't been used at all since any article linked to a youtube video does this in a different way.


## File

A link to download a local file. 

```mdx
<File path="/assets/postgres-railway.mov">
  Download the video
</File>
```

## AutoPlayVideo

For short gif-like videos, use this component. The path is the path to the video in the assets directory.

```mdx
<AutoPlayVideo path="/assets/postgres-railway.mov">
</AutoPlayVideo>
```

## InteractiveParallelism

A specialty custom component only used in the `concurrency-control` article. 

## SQLJoinsEditor

A specialty custom component used to allow writing and running sqlite code in the browser that is only used in the `sql-joins` article.