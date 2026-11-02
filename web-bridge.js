import { Readable } from 'node:stream'
import { finished } from 'node:stream/promises'

/** DSH authenticates this Fetch route and enforces its own Host/Origin rules. */
export function registerWorkbenchBridge(ctx, app, getRun) {
  return ctx.inject(['connection'], scope => {
    const handler = async request => {
        const reject = async (error, status) => {
          if (request.body) for await (const _ of Readable.fromWeb(request.body)) { /* drain before responding */ }
          return Response.json({ error }, { status })
        }
        const path = new URL(request.url).searchParams.get('path')
        if (!path?.startsWith('/api/') || path.includes('#') || new URL(path, 'http://wetflow').pathname.startsWith('/api/') === false)
          return reject('Invalid WetFlow API path.', 400)
        // Forward only public inputs. In particular, a browser must never supply
        // the private header used by the researcher-approval adapter.
        const headers = {}
        for (const key of ['content-type', 'x-wetflow-run']) {
          const value = request.headers.get(key)
          if (value !== null) headers[key] = value
        }
        if (request.method === 'POST' && path.split('?')[0] === '/api/evidence' && headers['x-wetflow-run'] !== getRun())
          return reject('实验运行已切换，请刷新后重新导入。', 409)
        request.signal.throwIfAborted()
        const payload = request.body ? Readable.fromWeb(request.body) : undefined
        const abort = () => payload?.destroy(new Error('Request cancelled'))
        request.signal.addEventListener('abort', abort, { once: true })
        try {
          const result = await app.inject({ method: request.method, url: path, headers, ...(payload ? { payload } : {}) })
          if (payload && !payload.readableEnded) { payload.resume(); await finished(payload) }
          const responseHeaders = new Headers({ 'Cache-Control': 'no-store' })
          for (const key of ['content-type', 'content-disposition']) {
            if (result.headers[key]) responseHeaders.set(key, String(result.headers[key]))
          }
          return new Response(request.method === 'HEAD' || [204, 304].includes(result.statusCode) ? null : result.rawPayload,
            { status: result.statusCode, headers: responseHeaders })
        } finally { request.signal.removeEventListener('abort', abort) }
    }
    for (const route of [
      {path:'/api/wetflow',methods:['GET','HEAD'],requestBody:'buffered'},
      {path:'/api/wetflow-write',methods:['POST','PUT','PATCH','DELETE'],requestBody:'streaming'},
    ]) scope.effect(() => scope.connection.fetch.register({...route,fetch:handler}), `WetFlow authenticated HTTP bridge: ${route.path}`)
  })
}
