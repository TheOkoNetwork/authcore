import { config } from './config.js'
const $ = window.$

const firebase = require('firebase/app').default
require('firebase/auth')

window.firebase = firebase

const toastr = require('toastr')
toastr.options.fadeOut = 7500
window.toastr = toastr

const init = async () => {
  console.log(`I am running on version: ${config('version')}`)

  console.table(config())

  $('title').text(config('serviceName'))
  const response = await window.fetch('/__/firebase/init.json')
  const firebaseConfig = await response.json()
  console.table(firebaseConfig)

  firebase.initializeApp(firebaseConfig)
  console.log(firebase.auth())

  console.log('Signing out')
  await firebase.auth().signOut()
  let service = ''
  const domain = window.location.hostname.split('auth.')[1]
  const serviceSplit = window.location.hash.split('service=')
  if (serviceSplit.length > 1) {
    service = serviceSplit[1].split('&')[0]
  }
  if (service) {
    console.log(`Detected service: ${service}`)
    if (
      service.replace(/[^0-9-a-z.]/gi, '').endsWith(`.${domain}`) ||
      service === domain
    ) {
      console.log('service is valid')
    } else {
      if (service === 'localhost') {
        console.log('Localhost, treating as valid service')
      } else {
        console.log(`Invalid domain for service: ${service}`)
        service = config('defaultService')
      }
    }
  } else {
    console.log('No service detected, defaulting url.')
    service = config('defaultService')
  }
  const redirectUrl = `https://${service}/signout?#signout=signout`
  console.log(`Using redirect Url: ${redirectUrl}`)
  window.location.href = redirectUrl
}
init()
