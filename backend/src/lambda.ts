import serverlessExpress from '@vendia/serverless-express'
import app from './index'

// Create the server once per Lambda container to enable connection reuse.
const expressHandler = serverlessExpress({ app })

export async function handlerFn(
  event: any,
  context: any
): Promise<any> {
  // vendia handler is callback-based in types; wrap it to a promise.
  return await new Promise((resolve, reject) => {
    expressHandler(event, context, (err: any, result: any) => {
      if (err) return reject(err)
      resolve(result)
    })
  })
}

// AWS Lambda expects `handler`.
export const handler = handlerFn
