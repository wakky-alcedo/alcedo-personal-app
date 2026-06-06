import React, { createContext, useContext, useState } from 'react'

const DEFAULT_SERVER = (import.meta.env.VITE_SERVER_URL as string) || 'http://localhost:8787'
const DEFAULT_API_KEY = 'dev-local-key'
const LS_SERVER_KEY = 'alcedo_server_url'
const LS_API_KEY = 'alcedo_api_key'

type AppConfig = {
  serverUrl: string
  apiKey: string
  setServerUrl: (value: string) => void
  setApiKey: (value: string) => void
}

const AppConfigContext = createContext<AppConfig>({
  serverUrl: DEFAULT_SERVER,
  apiKey: DEFAULT_API_KEY,
  setServerUrl: () => {},
  setApiKey: () => {},
})

export function AppConfigProvider({ children }: { children: React.ReactNode }) {
  const [serverUrl, setServerUrlState] = useState(
    () => localStorage.getItem(LS_SERVER_KEY) ?? DEFAULT_SERVER
  )
  const [apiKey, setApiKeyState] = useState(
    () => localStorage.getItem(LS_API_KEY) ?? DEFAULT_API_KEY
  )

  function setServerUrl(value: string) {
    setServerUrlState(value)
    localStorage.setItem(LS_SERVER_KEY, value)
  }

  function setApiKey(value: string) {
    setApiKeyState(value)
    localStorage.setItem(LS_API_KEY, value)
  }

  return (
    <AppConfigContext.Provider value={{ serverUrl, apiKey, setServerUrl, setApiKey }}>
      {children}
    </AppConfigContext.Provider>
  )
}

export function useAppConfig(): AppConfig {
  return useContext(AppConfigContext)
}
