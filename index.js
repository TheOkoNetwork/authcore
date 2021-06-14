const express = require('express')
const app = express()
app.use(express.json());
const cors = require('cors')
app.use(cors())
app.options('*', cors())

const port = process.env.PORT || 3000;
const fs = require('fs');

const admin = require('firebase-admin');
try {
        if (process.env.K_SERVICE) {
                console.log("Running under cloud run");
  admin.initializeApp({
    databaseURL: "https://parkplanr-dev.firebaseio.com",
  });
        } else {
                console.log("Not running under cloud run");
  admin.initializeApp({
    credential: admin.credential.cert(require('/home/codespace/serviceAccountKey.json')),
    databaseURL: "https://parkplanr-dev.firebaseio.com",
  });
        };
} catch (e) {
        console.log(e);
  // yes this is meant to be empty
}
const db = admin.firestore();

//const tenantManager = admin.auth().tenantManager();
//const tenantAuth = tenantManager.authForTenant('authTenantId');
const authManager = admin.auth();


app.use(express.static('public'))

const sgMail = require('@sendgrid/mail')
const getSMSecret = require('./getSecret'); 
const getTemplate = require('./getSendgridTemplate'); 

const initApp = async() => {
  console.log("Fetching secrets");
  sgMail.setApiKey(await getSMSecret("sendgridApiKey"))

  app.listen(port, () => {
    console.log(`AuthCORE listening at http://0.0.0.0:${port}`)
  })
}
const listAllUsers = async (nextPageToken,users=[]) => {
    console.log("Listing users");
    const listUsersResult = await admin
      .auth()
      .listUsers(1000, nextPageToken)
        listUsersResult.users.forEach((userRecord,index) => {
          const user = ({...userRecord});
          //There's zero reason for this to be provided so we remove it
          delete(user.passwordHash);
          delete(user.passwordSalt);
          users.push(user);
        });
        if (listUsersResult.pageToken) {
          return listAllUsers(listUsersResult.pageToken, user);
        } else {
          return users;
        }
  };


  const fetchUser = async (uid) => {
    console.log(`Fetching user: ${uid}`);
    const userFetchResult = await admin.auth().getUser(uid);
    console.log(userFetchResult);
    return userFetchResult;
  };

  const resetPassword = async (uid) => {
    console.log(`Fetching user: ${uid} for password reset`);
    const userFetchResult = await admin.auth().getUser(uid);
    console.log(userFetchResult);
    if (!userFetchResult.email) {
      console.log("User does not have an email address on record.");
      return {
        status: false,
        statusReason: "No email address for user",
      }
    }
    const resetUrl = await admin.auth().generatePasswordResetLink(userFetchResult.email);
    console.log(`Fetched reset link: ${resetUrl}`);

    const template = await getTemplate("PASSWORD_RESET");
    const msg = {
      to: userFetchResult.email,
      from: template['fromEmail'],
      templateId: template['templateId'],
      dynamic_template_data: {
        "RESET_URL": resetUrl,
        }
    };
    await sgMail.send(msg);

    return {
      status: true,
      statusReason: "Sent user password reset email"
    };
  };

  const blockUser = async (uid,blockingAdmin,reason) => {
    console.log(`Blocking user: ${uid} with reason: ${reason}`);
    const userFetchResult = await admin.auth().getUser(uid);
    console.log(userFetchResult);

    const blockPromises = [
      db.collection("users").doc(uid).collection("adminNotes").doc().set({
        admin: blockingAdmin,
        type: "action",
        action: "USER_BLOCK",
        comment: reason,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      }),
      admin.auth().updateUser(uid, {
        disabled: true
      })
    ];
    await Promise.all(blockPromises);
    return {
      status: true,
      statusReason: "Successfully blocked user"
    };
  };
  const unblockUser = async (uid,unblockingAdmin,reason) => {
    console.log(`Unblocking user: ${uid} with reason: ${reason}`);
    const userFetchResult = await admin.auth().getUser(uid);
    console.log(userFetchResult);

    const unblockPromises = [
      db.collection("users").doc(uid).collection("adminNotes").doc().set({
        admin: unblockingAdmin,
        type: "action",
        action: "USER_UNBLOCK",
        comment: reason,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      }),
      admin.auth().updateUser(uid, {
        disabled: false
      })
    ];
    await Promise.all(unblockPromises);
    return {
      status: true,
      statusReason: "Successfully unblocked user"
    };
  };

  const deleteUser = async (uid) => {
    console.log(`Deleting user: ${uid}`);
    const userFetchResult = await admin.auth().getUser(uid);
    console.log(userFetchResult);

    await admin.auth().deleteUser(uid);

    return {
      status: true,
      statusReason: "Successfully deleted user"
    };
  };



  const verifyAdminIdToken = async function (req, res, next) {
    const bearerHeader = req.headers['authorization'];
  
    if (bearerHeader) {
      const bearer = bearerHeader.split(' ');
      const bearerToken = bearer[1];
      req.token = bearerToken;
      let idTokenResult;
      try {
        idTokenResult = await admin.auth().verifyIdToken(req.token,true);
      } catch (error) {
        console.log(`Firebase ID Token verification failed with error: ${error}`)
        console.log("Treating as invalid credential-rejecting")
        return res.status(403).send({
          status: false,
          statusReason: "Invalid credentials"
        })
      }
      if (!idTokenResult.admin) {
        console.log("Valid credential, missing required claim-rejecting")
        return res.status(403).send({
          status: false,
          statusReason: "Not an admin"
        })
      };    
      console.log("Valid credential, has required claim-accepting")
      res.locals.adminUid = idTokenResult.uid;
      return next();
    } else {
      console.log("No credential provided, rejecting")
      return res.status(403).send({
        status: false,
        statusReason: "No credentials provided"
      });
    }
  }

app.get('/adminApi/users', verifyAdminIdToken, async (req, res) => {
  res.send({
    status: true,
    statusReason: "Provided list of users from auth",
    users: await listAllUsers()
  });
})

app.get('/adminApi/users/:uid', verifyAdminIdToken, async (req, res) => {
  res.send({
    status: true,
    statusReason: "Provided user data from auth",
    user: await fetchUser(req.params.uid)
  });
})
app.get('/adminApi/users/:uid/resetPassword', verifyAdminIdToken, async (req, res) => {
  const resetResult = await resetPassword(req.params.uid);
  console.log(resetResult);
  res.send(resetResult);
})
app.post('/adminApi/users/:uid/block', verifyAdminIdToken, async (req, res) => {
  const blockResult = await blockUser(req.params.uid,res.locals.adminUid,req.body.reason);
  console.log(blockResult);
  res.send(blockResult);
})
app.post('/adminApi/users/:uid/unblock', verifyAdminIdToken, async (req, res) => {
  const blockResult = await unblockUser(req.params.uid,res.locals.adminUid,req.body.reason);
  console.log(blockResult);
  res.send(blockResult);
})
app.post('/adminApi/users/:uid/delete', verifyAdminIdToken, async (req, res) => {
  const deleteResult = await deleteUser(req.params.uid);
  console.log(deleteResult);
  res.send(deleteResult);
})

app.get('/', (req, res) => {
  res.redirect('/signin');
})
app.get('/serviceConfig', (req, res) => {
  res.send(JSON.parse(process['env']['SERVICE_CONFIG']));
})

app.get('/signin', async function(req,res){
  localFilePath = `${__dirname}/public/signin.html`;
  console.log(localFilePath);
  res.sendFile(localFilePath);
});
app.get('/signup', async function(req,res){
  localFilePath = `${__dirname}/public/signup.html`;
  console.log(localFilePath);
  res.sendFile(localFilePath);
});
app.get('/signout', async function(req,res){
  localFilePath = `${__dirname}/public/signout.html`;
  console.log(localFilePath);
  res.sendFile(localFilePath);
});
app.get('/forgotpassword', async function(req,res){
  localFilePath = `${__dirname}/public/forgotpassword.html`;
  console.log(localFilePath);
  res.sendFile(localFilePath);
});
app.get('/img/splashSide', async function(req,res){
  localFolderPath = `${__dirname}/public/img/splashSides`;
  files = fs.readdirSync(localFolderPath);
  var file = files[Math.floor(Math.random() * files.length)];
  res.sendFile(`${localFolderPath}/${file}`);
});
app.post('/signin', async function(req,res){
  console.log("Got request to sign in");
  console.log(req.body);
  let uid, customClaims;
  try {
    const idTokenResult = await authManager.verifyIdToken(req.body.token,true);
    console.log("Successfully verified ID Token");
    console.log(JSON.stringify(idTokenResult));
    uid = idTokenResult.uid;
    const userRecord = await authManager.getUser(uid);
    console.log("Got user record");
    console.log(JSON.stringify(userRecord));
    customClaims = userRecord.customClaims;
    console.log(customClaims);
  } catch (err) {
    console.log(err);
    res.json({
      status: false,
      reason: "Failed verifying IDToken"
    });
    return;
  }
  var token;
  try {
    token = await authManager.createCustomToken(uid, customClaims);
  } catch (err) {
    console.log(err);
    res.json({
      status: false,
      reason: "Failed creating custom token"
    });
    return;
  }
  res.json({
    status: true,
    reason: "Signed in, token in token field",
    token: token
  });
});

app.get('/__/firebase/init.json', async function(req,res){
  res.send(JSON.parse(process.env['FIREBASE_INIT_JSON']));
});


initApp();