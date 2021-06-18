async function getTemplate (templateReference) {
    const admin = require('firebase-admin')
    try {
      admin.initializeApp()
    } catch (e) {
      // yes this is meant to be empty
    }

    const db = admin.firestore();
    const templateDoc = await db.collection("sendgridTemplates")
      .where("reference","==",templateReference)
      .get();
    if (templateDoc.empty) {
      throw new Error(`No template with reference: ${templateReference} found`);
    }
    const template = templateDoc.docs[0].data();
    const templateId = template.templateId;
    console.log(`Fetched template ID: ${templateId} for reference: ${templateReference}`);
    return template;
  };
  
  module.exports = getTemplate