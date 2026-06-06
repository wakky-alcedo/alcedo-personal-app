import { createContext, useContext } from 'react'

type AppConfig = {
  serverUrl: string
  apiKey: string
}

export const AppConfigContext = createContext<AppConfig>({
  serverUrl: 'http://localhost:8787',
  apiKey: 'dev-local-key',
})

export function useAppConfig(): AppConfig {
  return useContext(AppConfigContext)
}
