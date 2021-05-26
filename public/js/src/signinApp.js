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

  const serviceConfigResponse = await window.fetch("/serviceConfig");
  const serviceConfig = await serviceConfigResponse.json();
  console.table(serviceConfig);

  $('title').text(serviceConfig['serviceName'])
  const response = await window.fetch('/__/firebase/init.json')
  const firebaseConfig = await response.json()
  console.table(firebaseConfig)

  firebase.initializeApp(firebaseConfig)
  console.log(firebase.auth())

  $('#signinWithEmailPasswordButton').on('click', function () {
    signinEmail()
  })
  $('#signupWithEmailPasswordButton').on('click', function () {
    signupEmail()
  })

  $('#resetPasswordButton').on('click', function () {
    resetPassword()
  })

  $('#signinWithFacebookButton').on('click', function () {
    signinFacebook()
  })

  $('#signinWithGoogleButton').on('click', function () {
    signinGoogle()
  })

  $('#signinWithAppleButton').on('click', function () {
    signinApple()
  })

  if (!window.localStorage.service) {
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
        window.localStorage.service = service
      } else {
        if (service === 'localhost') {
          console.log('Localhost, treating as valid service')
          window.localStorage.service = service
          return
        }
        console.log(`Invalid domain for service: ${service}`)
        window.localStorage.service = serviceConfig['defaultService']
      }
    } else {
      console.log('No service detected, defaulting url.')
      window.localStorage.service = serviceConfig['defaultService']
    }
  }

  firebase.auth().onAuthStateChanged(async function (user) {
    console.log('Auth state changed')
    console.log(user)
    if (user) {
      console.log('Authenticated, fetching custom token')
      const idToken = await firebase.auth().currentUser.getIdToken()
      const postIdResult = await window.fetch('/signin', {
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          token: idToken
        }),
        method: 'POST'
      })
      console.log('Got ID Token post result')
      const idResult = await postIdResult.json()
      console.log(idResult)
      if (idResult.status) {
        console.log('Successfully authenticated and fetched custom token')
        const service = window.localStorage.service
        delete window.localStorage.service
        const redirectUrl = `https://${service}/signin?#token=${idResult.token}`
        console.log(redirectUrl)
        window.location.href = redirectUrl
      } else {
        console.log('Failed fetching custom token')
      }
    } else {
      console.log('Unauthenticated')
      getFirebaseRedirectResult()
    }
  })
}
function getFirebaseRedirectResult () {
  firebase
    .auth()
    .getRedirectResult()
    .then(function (result) {
      console.log('Got redirect result')
      console.log(result)
    })
    .catch(function (error) {
      console.log('Got redirect error')
      console.log(error)
      toastr.error(error.message, 'Error signing in')
    })
}

async function resetPassword () {
  const email = $('#email').val()
  try {
    const resetResult = await firebase.auth().sendPasswordResetEmail(email)
    console.log(resetResult)
    toastr.success(
      'Click the link in your email to reset your password',
      'Sent password reset email'
    )
  } catch (error) {
    console.log('Error sending password reset email')
    console.table(error)
    toastr.error(error.message, 'Failed resetting password')
  }
}
function signinEmail () {
  const email = $('#email').val()
  const password = $('#password').val()

  if (!email) {
    console.log('No email address provided')
    toastr.error(
      'Please enter your email address',
      'Error signing in with email address and password'
    )
    return
  }
  if (!password) {
    console.log('No password provided')
    toastr.error(
      'Please enter your password',
      'Error signing in with email address and password'
    )
    return
  }

  console.log('Attempting to sign in with email address and password')

  firebase
    .auth()
    .signInWithEmailAndPassword(email, password)
    .catch(function (error) {
      console.log('Error signing in with email address and password')
      console.table(error)
      switch (error.code) {
        case 'auth/user-not-found':
          console.log('User not found')
          error.userMessage =
            "We couldn't find a user account for that email address"
          break
        case 'auth/wrong-password':
          console.log('Wrong password')
          error.userMessage =
            "That password isn't right, if you have forgotten it click Lost Password below"
          break
        case 'auth/invalid-email':
          console.log('Email address invalid format')
          error.userMessage =
            "Whoops! That email address doesn't look quite right"
          break
        default:
          console.log(`Unknown error code: ${error.code}`)
          error.userMessage = error.message
        // todo bugsnag report this
      }
      toastr.error(
        error.userMessage,
        'Error signing in with email address and password'
      )
    })
}
function signupEmail () {
  const email = $('#email').val()
  const password = $('#password').val()

  if (!email) {
    console.log('No email address provided')
    toastr.error(
      'Please enter your email address',
      'Error signing up with email address and password'
    )
    return
  }
  if (!password) {
    console.log('No password provided')
    toastr.error(
      'Please enter your password',
      'Error signing up with email address and password'
    )
    return
  }

  console.log('Attempting to sign up with email address and password')

  firebase
    .auth()
    .createUserWithEmailAndPassword(email, password)
    .catch(function (error) {
      console.log('Error signing up with email address and password')
      console.table(error)
      switch (error.code) {
        case 'auth/invalid-email':
          console.log('Email address invalid format')
          error.userMessage =
            "Whoops! That email address doesn't look quite right"
          break
        default:
          console.log(`Unknown error code: ${error.code}`)
          error.userMessage = error.message
        // todo sentry report this
      }
      toastr.error(
        error.userMessage,
        'Error signing up with email address and password'
      )
    })
}

function signinFacebook () {
  const provider = new firebase.auth.FacebookAuthProvider()
  firebase.auth().signInWithRedirect(provider)
}
function signinGoogle () {
  const provider = new firebase.auth.GoogleAuthProvider()
  firebase.auth().signInWithRedirect(provider)
}

function signinApple () {
  const provider = new firebase.auth.OAuthProvider('apple.com')
  firebase.auth().signInWithRedirect(provider)
}

init()
