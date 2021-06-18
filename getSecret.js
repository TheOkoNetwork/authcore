const fetch = require('node-fetch');

async function getSMSecret (secretName, secretVersion = 'latest') {
    const projectFetchRes = await fetch('http://metadata.google.internal/computeMetadata/v1/project/project-id', {
      method: 'get',
      headers: { 'Metadata-Flavor': 'Google' },
    });
    const projectId = await projectFetchRes.text();

    console.log(`Using project ID: ${projectId}`)
  
    const {
      SecretManagerServiceClient
    } = require('@google-cloud/secret-manager')
    const secretClient = new SecretManagerServiceClient()
  
    const [version] = await secretClient.accessSecretVersion({
      name: `projects/${projectId}/secrets/${secretName}/versions/${secretVersion}`
    })
    const payload = version.payload.data.toString();
    return payload
  }
  
  module.exports = getSMSecret