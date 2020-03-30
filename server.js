// Require the framework and instantiate it
const fastify = require('fastify')({ logger: true })
const {google} = require('googleapis');
const streamifier = require('streamifier');
//Note: i renamed the private_key name.
const privateKey = require('./private_key.json');

const fileUpload = require('fastify-file-upload')

//Register the lib
fastify.register(fileUpload)

// Default host
fastify.get('/', async () => {
  return "This service is working properly!"
})

//Create upload-file route
fastify.post('/upload-file', async(req, res) => {
  //If we use fastify-file-upload lib, we will get the raw object from request
  const files = req.raw.files;
  const file = files.file
  
  //Load client_email and private_key from private_key.json that u already download it from GCP. Use it on auth
  const jWTClient = new google.auth.JWT(
      //ex: dafa-project-gdrive-restapi@gdrive-restapi-00.iam.gserviceaccount.com
      privateKey.client_email,
      //stay null
      null,
      //ex: -----BEGIN PRIVATE KEY-----\blablabla\n-----END PRIVATE KEY-----\n
      privateKey.private_key,
      //ex: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/drive.file'] etc.
      ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/drive.file']
  );
  //By default, file that you upload, need an permission access, so handle it with creating an permission
  const permissions = {
      'type': 'anyone',
      'role': 'reader'
  };
  const result = await google.drive({ version: 'v3'}).files.create({
    auth: jWTClient,
    media: {
      mimeType: file.mimetype,
      //I'm using streamifier to convert a buffer into a readable stream
      body: streamifier.createReadStream(file.data),
    },
    resource: {
      name: file.name.split('.')[0],
    },
    fields: 'id',
  }).then((resp) => {
    google.drive({ version: 'v3'}).permissions.create({
      auth: jWTClient,
      resource: permissions,
      fileId: resp.data.id,
      fields: 'id',
    }, (err) => {
      if (err) {
        return res.code(400).send(new Error('Error giving permissions & upload file to GDrive'))
      }
    });
    //You can open your file with this template url: https://drive.google.com/file/d/yourFileId
    return res.code(200).send({statusCode: 200, error: null, data: `https://drive.google.com/file/d/${resp.data.id}`, message: 'Success'})
  }).catch((error) => {
    return res.code(400).send(new Error(`Error uploading file to GDrive ${error}`))
  });
  return result;
})

// Run the server!
const start = async () => {
  try {
    await fastify.listen(7000)
    fastify.log.info(`server listening on ${fastify.server.address().port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}
start()