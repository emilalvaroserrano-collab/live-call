/* eslint-disable */
// @ts-nocheck
// Minimal generated route tree. TanStack Start may regenerate this file during development/build.

import { Route as rootRouteImport } from './routes/__root'
import { Route as IndexRouteImport } from './routes/index'
import { Route as ApiDonateRouteImport } from './routes/api.donate'
import { Route as ApiTranslateTokenRouteImport } from './routes/api.translate-token'
import { Route as ApiTranslationLanguagesRouteImport } from './routes/api.translation-languages'

const IndexRoute = IndexRouteImport.update({ id: '/', path: '/', getParentRoute: () => rootRouteImport } as any)
const ApiDonateRoute = ApiDonateRouteImport.update({ id: '/api/donate', path: '/api/donate', getParentRoute: () => rootRouteImport } as any)
const ApiTranslateTokenRoute = ApiTranslateTokenRouteImport.update({ id: '/api/translate-token', path: '/api/translate-token', getParentRoute: () => rootRouteImport } as any)
const ApiTranslationLanguagesRoute = ApiTranslationLanguagesRouteImport.update({ id: '/api/translation-languages', path: '/api/translation-languages', getParentRoute: () => rootRouteImport } as any)

const rootRouteChildren = {
  IndexRoute,
  ApiDonateRoute,
  ApiTranslateTokenRoute,
  ApiTranslationLanguagesRoute,
}

export const routeTree = rootRouteImport._addFileChildren(rootRouteChildren)

import type { getRouter } from './router.tsx'
import type { createStart } from '@tanstack/react-start'
declare module '@tanstack/react-start' {
  interface Register {
    ssr: true
    router: Awaited<ReturnType<typeof getRouter>>
  }
}
