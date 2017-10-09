type SessionType = {
  id: string,
  name: string,
  startedAt: number,
}
export type SessionDBType = {
  [key: string]: SessionType,
}

export type SessionDocumentType = {
  [key: string]: string[],
}
