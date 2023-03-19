
import { BetaAnalyticsDataClient } from '@google-analytics/data'
import { updatePostAnalytics, getAllPosts } from './dynamo.js'

import { updateAlgolia } from './algolia.js'

import dotenv from "dotenv"
dotenv.config()

const GA4_PROPERTY_ID = '336033649';

// Using a default constructor instructs the client to use the credentials
// specified in GOOGLE_APPLICATION_CREDENTIALS environment variable.
const analyticsDataClient = new BetaAnalyticsDataClient();

// Runs a simple report.
async function runReport() {
  const [response] = await analyticsDataClient.runReport({
    limit: 100000,
    offset: 0,
    property: `properties/${GA4_PROPERTY_ID}`,
    dateRanges: [
      {
        startDate: '7daysAgo',
        endDate: 'today',
      },
    ],
    dimensions: [
      {
        name: 'pagePath',
      }
    ],
    metrics: [
      {
        name: "userEngagementDuration"
      },
      {
        name: "screenPageViews"
      },
      {
        name: 'activeUsers',
      },
    ],
  });

  return response
}

const response = await runReport();

// console.log('Report result:');
// // write teh response to a file
// fs.writeFileSync('./src/data.json', JSON.stringify(response, null, 2))
// response.rows.forEach(row => {
//   console.log(row.dimensionValues[0], row.metricValues[0]);
// });

const posts = await getAllPosts()

posts.forEach(post => {
  const row = response.rows.find(row => row.dimensionValues[0].value.replace(/\//, '') === post.slug)
  post.analyticsUserEngagementDuration = Number(row?.metricValues?.[0]?.value) || 0
  post.analyticsScreenPageViews = Number(row?.metricValues?.[1]?.value) || 0
  post.analyticsActiveUsers = Number(row?.metricValues?.[2]?.value) || 0
})

// console.log({ posts })

for (const post of posts) {
  console.log("update post", post.slug)
  await updatePostAnalytics(post)
}

await updateAlgolia(posts.map(p => ({ 
  slug: p.slug,
  analyticsUserEngagementDuration: p.analyticsUserEngagementDuration,
  analyticsScreenPageViews: p.analyticsScreenPageViews,
  analyticsActiveUsers: p.analyticsActiveUsers,
 })))