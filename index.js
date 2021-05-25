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

//const tenantManager = admin.auth().tenantManager();
//const tenantAuth = tenantManager.authForTenant('authTenantId');
const authManager = admin.auth();


app.use(express.static('public'))

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
      return next();
    } else {
      console.log("No credential provided, rejecting")
      return res.status(403).send({
        status: false,
        statusRason: "No credentials provided"
      });
    }
  }
  app.get('/adminApi/users', verifyAdminIdToken, async (req, res) => {
  res.send(await listAllUsers());
})

app.get('/', (req, res) => {
  res.redirect('/signin');
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

app.listen(port, () => {
  console.log(`AuthCORE listening at http://0.0.0.0:${port}`)
})
