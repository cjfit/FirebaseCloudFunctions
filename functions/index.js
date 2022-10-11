/* eslint-disable */
const NaturalLanguageUnderstandingV1 = require('ibm-watson/natural-language-understanding/v1');
const { IamAuthenticator } = require('ibm-watson/auth');
const naturalLanguageUnderstanding = new NaturalLanguageUnderstandingV1({
  version: '2021-08-01',
  authenticator: new IamAuthenticator({
    apikey: 'PROCESS.ENV.API_KEY',
  }),
  serviceUrl: 'https://api.us-east.natural-language-understanding.watson.cloud.ibm.com/instances/856c1be6-8a0c-4eac-8ead-524ef8175287',
});
const fetch = require('node-fetch');
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

// listen for writes to therapists/{therapist} and triggers google search function
exports.triggerSearch = functions.firestore
    .document("therapists/{therapist}")
    .onCreate((snap, context) => {
      // const biofull = snap.data();
      provider_name = context.params.therapist
      googleSearch(provider_name)
      return provider_name;
    });

    // 
exports.triggerWatson = functions.firestore
    .document("therapists/{therapist}/customsearchapi/{doc}")
    .onCreate((snap, context) => {
      const docValue = snap.data();
      const displayLink = docValue.displayLink;
      const queryLink = docValue.link;
      provider_name = context.params.therapist
      if (displayLink == "www.psychologytoday.com") {
        watsonQuery(queryLink, provider_name)
      }
      return provider_name;
    });

function watsonQuery(search_url, provider_name) {
  const analyzeParams = {
    'url': search_url,
    'features': {
      'sentiment': {},
      'categories': {},
      'concepts': {},
      'entities': {},
      'keywords': {},
    }
    
  };
  
  naturalLanguageUnderstanding.analyze(analyzeParams)
    .then(analysisResults => {
      subdir = "watson-psychtoday/"
      excluded_tokenize_paths = []
      addToDb(analysisResults, subdir, excluded_tokenize_paths)
    })
    .catch(err => {
      console.log('error:', err);
    });
}



function googleSearch(provider_name) {
// remove spaces
let url = "https://www.googleapis.com/customsearch/v1?key=AIzaSyDrk9PP_stEVayTVBA-Mrhv3tltDhHiD88&cx=bf4a1b10adf865842&q="+provider_name;



let settings = { method: "Get" };

fetch(url, settings)
    .then(res => res.json())
    .then((json) => {
        // console.log(json)
        data = json
        subdir = "customsearchapi/"
        excluded_tokenize_paths = ['context','searchInformation','url']
        addToDb(data, subdir, excluded_tokenize_paths)
    });
  }
    function addToDb(data, subdir, excluded_tokenize_paths) {
    
      provider_name = provider_name.replace(/\s/g, '');
      
      
      
      /**
       * Data is a collection if
       *  - it has a odd depth
       *  - contains only objects or contains no objects.
       */
      function isCollection(data, path, depth) {
        if (
          typeof data != 'object' ||
          data == null ||
          data.length === 0 ||
          isEmpty(data)
        ) {
          return false;
        }
      
        for (const key in data) {
          if (typeof data[key] != 'object' || data[key] == null) {
            // If there is at least one non-object item in the data then it cannot be collection.
            return false;
          }
        }
      
      
        //console.log(data)
        //console.log(path)
        return true;
      }
      
      // Checks if object is empty.
      function isEmpty(obj) {
        for(const key in obj) {
          if(obj.hasOwnProperty(key)) {
            return false;
          }
        }
        return true;
        
      }

      async function upload(data, path) {
        return await admin.firestore()
          // define root-level collection here
          .doc("/therapists/"+provider_name+"/"+subdir+path+"/")
          .set(data)
          .then(() => console.log(`Document ${path.join('/')} uploaded.`))
          //.catch(() => console.error(`Could not write document ${path.join('/')}.`), console.log(error));
      
      }
      
      /**
       *
       */
      async function resolve(data, path = []) {         // doesn't include excluded path
        if (path.length > 0 && path.length % 2 == 0 && !excluded_tokenize_paths.includes(path[0])) {
          // Document's length of path is always even, however, one of keys can actually be a collection.
          // Copy an object.
          // console.log(data)
          // console.log(path)
          // console.log(path[0])
          const documentData = Object.assign({}, data);
      
          for (const key in data) {
            // Resolve each collection and remove it from document data.
            if (isCollection(data[key], [...path, key])) {
              // Remove a collection from the document data.
              delete documentData[key];
              // Resolve a colleciton.
              resolve(data[key], [...path, key]);
            }
          }
      
          // If document is empty then it means it only consisted of collections.
          if (!isEmpty(documentData)) {
            // Upload a document free of collections.
            //console.log(documentData)
            await upload(documentData, path);
          }
        } 
        else if (excluded_tokenize_paths.includes(path[0])) {
          console.log(data)
          // upload
          await upload(data, path);
          
      
        }
      
        
        else {
          // Collection's length of is always odd.
          //console.log(data)
          //console.log(path)
          for (const key in data) {
            // Resolve each collection.
            await resolve(data[key], [...path, key]);
          }
        }
      }
      
      resolve(data);
      }
