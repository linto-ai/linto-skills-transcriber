const debug = require('debug')(`linto:skill:v2:linto-skill:transcribe:controllers:fileUpload`)

const DEFAULT_MAX_SIZE_FILE = 10  // Mo
const BYTE_SIZE = 1024
const REQUEST_ACCEPT_FORMAT = ['application/json', 'text/plain', 'text/vtt', 'text/srt']
const DEFAULT_MEDIA_TYPE = 'audio/wav'
const DEFAULT_INTERVAL_TIMER = 1000 //ms
const DEFAULT_OPTION = {
  headers : {
    accept : REQUEST_ACCEPT_FORMAT[0]
  }
}

let jobsInterval = {}

module.exports = async function (msg, conf) {
  try{
    if (msg.payload.audio) {
      const audio = msg.payload.audio
      delete msg.payload.audio

      const file = createFile(audio, conf.filesize)
      if (Buffer.isBuffer(file.value)) {
        const options = prepareRequest(file, msg.payload)

        let transcriptResult = await this.request.post(conf.host + '/transcribe', options)
        let result = wrapperLinstt.call(this, transcriptResult, options, msg)

        if(options.formData.force_sync === 'false' && result.jobId){
          let interval = DEFAULT_INTERVAL_TIMER
          if (conf.interval && isNumeric(conf.interval)) interval = conf.interval

          jobsInterval[result.jobId] = setInterval(createJobInterval.bind(this, msg, result.jobId, conf), interval)
        }

        return result
      }
    }else
      return {error:'Input should containt an audio buffer'}
  }catch(err){
    return {
      state : 'error',
      error : err.message
    }
  }
}

function createFile(audio, maxBufferSize){
  let file = {
    options: {
    }
  }
  
  if(audio.match("data:(.*);base64,") !== null){
    file.options.type = audio.match("data:(.*);base64,")[1]
    file.options.contentType = file.options.type
  } else {
    file.options.type = DEFAULT_MEDIA_TYPE
    file.options.contentType = file.options.type
  }

  file.options.filename = file.options.type.split('/').pop()
  file.value = Buffer.from(audio.split("base64,").pop(), 'base64')
  
  // Check file size 
  const bufferSize = Buffer.byteLength(file.value)
  const bufferMoSize = bufferSize / BYTE_SIZE / BYTE_SIZE // convert to Mo

  if(maxBufferSize === undefined || maxBufferSize === '')
    maxBufferSize = DEFAULT_MAX_SIZE_FILE

  if((maxBufferSize - bufferMoSize ) > 0)
    return file


  throw new Error('File is to big')
}

function prepareRequest(file, payload) {
  let options = { 
    headers : {},
    formData : {
      file // File is already a buffer
    }
  }

  if(payload.accept && REQUEST_ACCEPT_FORMAT.indexOf(payload.accept) > -1)
    options.headers.accept = payload.accept
  else 
    options.headers.accept = REQUEST_ACCEPT_FORMAT[0] // By default application/json

  if(payload.transcriptionConfig)
    options.formData.transcriptionConfig = JSON.stringify(payload.transcriptionConfig)

  if(payload.force_sync)
    options.formData.force_sync = payload.force_sync
  else
    options.formData.force_sync = 'false'

  return options
}

function wrapperLinstt(transcriptionResult, options) {
  let output = {}

  if (options.headers.accept === 'application/json') { // application/json
    let json = JSON.parse(transcriptionResult)

    if(options.formData.force_sync === 'false'){
      output.jobId = json.jobid
      output.state = 'file_uploaded'
    } else {
      if (!json)
        throw new Error('Transcription was empty')
      return json
    }
  } else { // Text plain
    if (transcriptionResult === undefined ||  transcriptionResult.length === 0)
      throw new Error('Transcription was empty')
    else if(options.formData.force_sync === 'false'){
      output.jobId = transcriptionResult
      output.state = 'file_uploaded'
    }else {
      output.transcript = {
        text : transcriptionResult
      }
    }
  }
  return output
}

async function createJobInterval(msg, jobId, conf){
  try{
    let jobs = {}
    jobs.str = await this.request.get(`${conf.host}/job/${jobId}` , DEFAULT_OPTION, jobsHandler)
    jobs.json = JSON.parse(jobs.str)
    
    if(jobs.json.state === 'done' && jobs.json.result_id){  //triger last request
        msg.payload.behavior = { ...jobs.json, job_id : jobId}
      this.wireEvent.notifyOut(this.node.z, msg)
      clearInterval(jobsInterval[jobId])
      delete jobsInterval[jobId]
    }else {
      msg.payload.behavior = { ...jobs.json, job_id : jobId }
      this.wireEvent.notifyOut(this.node.z, msg)
    }

  }catch(err){
    msg.payload.behavior = { error : err.message }
    this.wireEvent.notifyOut(this.node.z, msg)
    
    clearInterval(jobsInterval[jobId])
    delete jobsInterval[jobId]

    throw new Error('Service error')
  }
}

const jobsHandler = function (error, response, body) {
  if (error) 
    return error
  if (response === undefined || response.statusCode >= 400) {
    new Error('Service error')
  }
  console.log(body)
  return body
}