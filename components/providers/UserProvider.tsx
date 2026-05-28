'use client'
import { createContext, useContext } from 'react'

export interface UserContextValue {
  email: string | null
  name: string | null
  role: string | null
}

const UserContext = createContext<UserContextValue>({ email: null, name: null, role: null })

export function UserProvider({
  email,
  name,
  role,
  children,
}: UserContextValue & { children: React.ReactNode }) {
  return (
    <UserContext.Provider value={{ email, name, role }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser(): UserContextValue {
  return useContext(UserContext)
}
