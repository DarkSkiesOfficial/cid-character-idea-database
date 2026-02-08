import { app } from 'electron'
import { resolve, join, dirname } from 'path'
import { is } from '@electron-toolkit/utils'

export function getAppRoot(): string {
  if (is.dev) {
    return resolve(join(__dirname, '..', '..', '..'))
  }
  return dirname(app.getPath('exe'))
}

export function getUserDataRoot(): string {
  if (is.dev) {
    return resolve(join(__dirname, '..', '..', '..', 'data'))
  }
  return app.getPath('userData')
}
