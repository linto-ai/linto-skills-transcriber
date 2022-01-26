const debug = require('debug')(`linto:skill:v2:linto-skill:transcribe:controllers:fileUpload`)

const DEFAULT_MAX_SIZE_FILE = 10  // Mo
const BYTE_SIZE = 1024
const REQUEST_ACCEPT_FORMAT = ['application/json', 'text/plain', 'text/vtt', 'text/srt']
const DEFAULT_MEDIA_TYPE = 'audio/wav'

let jobsInterval = {}
//state : diarization, transcription, punctuation, error, (pending, unknown, done) => untill one of them
// done -> create path /result 

module.exports = async function (msg, conf) {
  const audio = msg.payload.audio
  if (audio) {
    delete msg.payload.audio
    
    const file = createFile(audio, conf.filesize)
    if (Buffer.isBuffer(file.value)) {
      const options = prepareRequest(file, msg.payload)

      let transcriptResult = await this.request.post(conf.host + '/transcribe', options)
      let result = wrapperLinstt.call(this, transcriptResult, options, msg)

      if(result.jobId){
        jobsInterval[result.jobId] = setInterval(createJobInterval.bind(this, msg, result.jobId, conf, options), 1000)
      }

      return result
    }
  }else 
    return {error:'Input should containt an audio buffer'}
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

  if(payload.accept && payload.accept === REQUEST_ACCEPT_FORMAT.indexOf(payload.accept) > -1)
    options.headers.accept = payload.accept
  else 
    options.headers.accept = REQUEST_ACCEPT_FORMAT[0] // By default application/json

  if(payload.transcriptionConfig)
    options.formData.transcriptionConfig = JSON.stringify(payload.transcriptionConfig)

  if(payload.force_sync)
    options.formData.force_sync = payload.force_sync
  else
    options.formData.force_sync = 'false'

  //TODO: NEED TO BE REMOVE
  options.formData.no_cache = 'true'

  return options
}

function wrapperLinstt(transcript, options, msg) {
  let output = {}
  if (options.headers.accept === 'application/json') {
    let json = JSON.parse(transcript)

    if(options.formData.force_sync === 'false' && json.raw_transcription === undefined){
      output.jobId = json.jobid //Manage pulling from here ?
    }else {
      if (!json || json.transcription_result.length === 0) 
        throw new Error('Transcription was empty')
      
      output.transcript = {}
      output.transcript.text = json.transcription_result
      output.transcript.confidenceScore = json.confidence  

      const transcriptionConfig = JSON.parse(options.formData.transcriptionConfig)
      if(transcriptionConfig.diarizationConfig.enableDiarization === true)
        output.transcript.segments = json.segments
    }
  } else {
    if (transcript.toString('utf8').text === undefined ||  transcript.toString('utf8').length === 0) 
      throw new Error('Transcription was empty')

    output.transcript.text = {}
    output.text = transcript.toString('utf8')
  }

  return output
}

async function createJobInterval(msg, jobId, conf, requestOption){
  try{
    const url = `${conf.host}/job/${jobId}` 
    const options = {
      headers : requestOption.headers
    }
    
    const strResult = await this.request.get(url, options, jobsHandler)
    const jsonResult = JSON.parse(strResult)
    if(jsonResult.progress === undefined){
      msg.payload.behavior = jsonResult
      this.wireEvent.notifyOut(this.node.z, msg)

      clearInterval(jobsInterval[jobId])
      delete jobsInterval[jobId]
    }else {
      msg.payload.behavior = { ...jsonResult, job_id : jobId }
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