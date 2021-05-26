export function config (key) {
  const configStore = {}
  configStore.version = '{{APP_VERSION_HERE}}'
  configStore.defaultService = 'dev.parkplanr.app'
  configStore.serviceName = 'ParkPlanr'

  if (!key) {
    return configStore
  }

  if (configStore[key]) {
    return configStore[key]
  } else {
    throw new Error(`Config key: ${key} unknown`)
  }
}
